import { createHash, randomBytes } from 'node:crypto';
import type { CheckId } from './catalog.ts';
import type { Finding } from './checks.ts';
import type { ScanContext } from './context.ts';
import { fetchUrl, type HttpResult } from './http.ts';

/**
 * A short, fixed list of files that should never be public. Each has a content test, so a site
 * that answers every address with a normal page (a "soft 404") isn't reported as exposed.
 */
type Probe = { path: string; checkId: CheckId; looksReal: (body: Buffer, res: HttpResult) => boolean };

const text = (body: Buffer) => body.toString('latin1');
const notHtml = (body: Buffer, res: HttpResult) =>
  !/text\/html/i.test(String(res.headers['content-type'] ?? '')) && !/^\s*<(!doctype|html|head|body)/i.test(text(body));
const startsWith = (body: Buffer, bytes: number[]) => bytes.every((b, i) => body[i] === b);

const envFile = (body: Buffer, res: HttpResult) =>
  notHtml(body, res) && (text(body).match(/^\s*(export\s+)?[A-Z][A-Z0-9_]*\s*=/gm)?.length ?? 0) >= 2;
const sqlDump = (body: Buffer, res: HttpResult) =>
  notHtml(body, res) && /(CREATE TABLE|INSERT INTO|-- (MySQL|MariaDB) dump|PostgreSQL database dump)/i.test(text(body));
const zipFile = (body: Buffer) => startsWith(body, [0x50, 0x4b, 0x03, 0x04]);
const gzipFile = (body: Buffer) => startsWith(body, [0x1f, 0x8b]);
const wpConfig = (body: Buffer) => /define\(\s*['"]DB_(PASSWORD|USER|NAME)['"]/.test(text(body));

export const PROBES: Probe[] = [
  { path: '/.env', checkId: 'path.env_exposed', looksReal: envFile },
  { path: '/.git/HEAD', checkId: 'path.git_exposed', looksReal: (b, r) => notHtml(b, r) && /^(ref: refs\/|[0-9a-f]{40}\s*$)/.test(text(b)) },
  { path: '/.git/config', checkId: 'path.git_exposed', looksReal: (b, r) => notHtml(b, r) && /^\s*\[core\]/m.test(text(b)) },
  { path: '/.htpasswd', checkId: 'path.htpasswd_exposed', looksReal: (b, r) => notHtml(b, r) && /^[^:\s<]+:(\$|\{SHA\}|[A-Za-z0-9./]{13})/m.test(text(b)) },
  { path: '/wp-config.php.bak', checkId: 'path.backup_exposed', looksReal: wpConfig },
  { path: '/wp-config.php~', checkId: 'path.backup_exposed', looksReal: wpConfig },
  { path: '/backup.zip', checkId: 'path.backup_exposed', looksReal: zipFile },
  { path: '/backup.tar.gz', checkId: 'path.backup_exposed', looksReal: gzipFile },
  { path: '/backup.sql', checkId: 'path.backup_exposed', looksReal: sqlDump },
  { path: '/db.sql', checkId: 'path.backup_exposed', looksReal: sqlDump },
  { path: '/dump.sql', checkId: 'path.backup_exposed', looksReal: sqlDump },
  { path: '/phpinfo.php', checkId: 'path.debug_page_exposed', looksReal: (b) => /<title>(phpinfo\(\)|PHP \d)/i.test(text(b)) },
  { path: '/info.php', checkId: 'path.debug_page_exposed', looksReal: (b) => /<title>(phpinfo\(\)|PHP \d)/i.test(text(b)) },
  { path: '/server-status', checkId: 'path.debug_page_exposed', looksReal: (b) => /Apache Server Status for/i.test(text(b)) },
  { path: '/phpmyadmin/', checkId: 'path.db_admin_exposed', looksReal: (b) => /phpMyAdmin/.test(text(b)) && /<form|pma_/i.test(text(b)) },
  { path: '/.DS_Store', checkId: 'path.ds_store_exposed', looksReal: (b) => startsWith(b, [0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31]) },
];

/** Every check this module reports on, in report order. */
const CHECK_IDS = [...new Set(PROBES.map((p) => p.checkId))];

const CONCURRENCY = 2;
const DELAY_MS = 200;
const MAX_BODY = 16 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const digest = (body: Buffer | undefined) => createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');

async function fetchQuietly(ctx: ScanContext, url: URL): Promise<HttpResult | null> {
  try {
    return await fetchUrl(ctx, url, { timeoutMs: 5000, maxBodyBytes: MAX_BODY });
  } catch {
    return null;
  }
}

/**
 * Looks for the files above on `origin` (the site's own homepage origin). Gently: two requests
 * at a time with a pause between, no redirects followed, and only the first 16 KB of any answer.
 * Returns one finding per kind of file, or nothing if the site couldn't be probed.
 */
export async function probePaths(ctx: ScanContext, origin: URL): Promise<Finding[]> {
  // What does this site send for an address that can't exist? Identical answers are ignored.
  const baseline = await fetchQuietly(ctx, new URL(`/sentry-check-${randomBytes(6).toString('hex')}`, origin));
  if (!baseline) return [];
  const softNotFound = baseline.status === 200 ? digest(baseline.body) : null;

  const exposed = new Map<CheckId, string[]>();
  let checked = 0;
  for (let i = 0; i < PROBES.length; i += CONCURRENCY) {
    if (Date.now() > ctx.deadline) break;
    if (i > 0) await sleep(DELAY_MS);
    const batch = PROBES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((probe) => fetchQuietly(ctx, new URL(probe.path, origin))));
    batch.forEach((probe, j) => {
      const res = results[j];
      if (!res) return;
      checked++;
      if (res.status !== 200 || !res.body?.length) return;
      if (softNotFound && digest(res.body) === softNotFound) return;
      if (!probe.looksReal(res.body, res)) return;
      exposed.set(probe.checkId, [...(exposed.get(probe.checkId) ?? []), probe.path]);
    });
  }
  // If most requests failed (blocked, timed out), don't claim the files are safe.
  if (checked < PROBES.length / 2) return [];

  return CHECK_IDS.map((checkId) => {
    const paths = exposed.get(checkId);
    return paths
      ? { checkId, status: 'fail' as const, evidence: paths.map((p) => `GET ${new URL(p, origin).href} → 200`).join(' · ') }
      : { checkId, status: 'pass' as const };
  });
}
