// Gives an account a verified yourbakery.example with four made-up checks (scores 42 → 52 → 66 → 82),
// so the website page's chart and "since your last check" have something to show.
// Usage: node --env-file=../.env scripts/seed-history.ts you@example.com   (development only)
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.ts';
import { domains, user } from '../src/db/schema.ts';
import { newVerifyToken } from '../src/domains/verify.ts';
import type { Finding } from '../src/scanner/checks.ts';
import { buildReport } from '../src/scanner/scan.ts';
import { saveScan } from '../src/scans/store.ts';

if (process.env.NODE_ENV === 'production') throw new Error('Development only.');
const email = process.argv[2];
if (!email) throw new Error('Usage: node --env-file=../.env scripts/seed-history.ts you@example.com');

const HOST = 'yourbakery.example';
const pass = (checkId: Finding['checkId']): Finding => ({ checkId, status: 'pass' });
const fail = (checkId: Finding['checkId']): Finding => ({ checkId, status: 'fail' });
const always = [pass('tls.no_https'), pass('tls.cert_invalid'), pass('tls.cert_expiring_soon'), pass('tls.legacy_protocol')];
const files = [
  pass('path.env_exposed'),
  pass('path.git_exposed'),
  pass('path.htpasswd_exposed'),
  pass('path.backup_exposed'),
  pass('path.debug_page_exposed'),
  pass('path.db_admin_exposed'),
  pass('path.ds_store_exposed'),
];

// 5 medium + 2 low failing = 42; fix one medium = 52; fix a medium and a low = 66;
// fix two mediums but a version number starts leaking = 82.
const checks: [string, Finding[]][] = [
  ['2026-09-22T10:02:00Z', [fail('http.no_https_redirect'), fail('header.hsts_missing'), fail('header.csp_missing'), fail('tls.cert_expiring_soon'), fail('path.debug_page_exposed'), fail('header.xcto_missing'), fail('header.referrer_policy_missing'), pass('header.xfo_missing'), pass('header.server_version_leak')]],
  ['2026-09-25T16:40:00Z', [fail('http.no_https_redirect'), fail('header.hsts_missing'), fail('header.csp_missing'), pass('tls.cert_expiring_soon'), fail('path.debug_page_exposed'), fail('header.xcto_missing'), fail('header.referrer_policy_missing'), pass('header.xfo_missing'), pass('header.server_version_leak')]],
  ['2026-09-29T09:14:00Z', [fail('http.no_https_redirect'), fail('header.hsts_missing'), fail('header.csp_missing'), pass('tls.cert_expiring_soon'), pass('path.debug_page_exposed'), fail('header.xcto_missing'), pass('header.referrer_policy_missing'), pass('header.xfo_missing'), pass('header.server_version_leak')]],
  ['2026-10-01T14:05:00Z', [pass('http.no_https_redirect'), pass('header.hsts_missing'), fail('header.csp_missing'), pass('tls.cert_expiring_soon'), pass('path.debug_page_exposed'), fail('header.xcto_missing'), pass('header.referrer_policy_missing'), pass('header.xfo_missing'), fail('header.server_version_leak')]],
];

const [account] = await db.select().from(user).where(eq(user.email, email));
if (!account) throw new Error(`No account with that email.`);
const [existing] = await db.select().from(domains).where(and(eq(domains.userId, account.id), eq(domains.hostname, HOST)));
if (!existing) {
  await db.insert(domains).values({ userId: account.id, hostname: HOST, verifyToken: newVerifyToken(), verifiedAt: new Date() });
}
for (const [scannedAt, results] of checks) {
  const byId = new Map([...always, ...files].map((f) => [f.checkId, f]));
  for (const r of results) byId.set(r.checkId, r);
  const report = buildReport({ hostname: HOST, mode: 'full', scannedAt, durationMs: 9800, findings: [...byId.values()] });
  await saveScan(account.id, report);
  console.log(scannedAt.slice(0, 10), report.score, report.grade);
}
await pool.end();
