import fs from 'node:fs';
import path from 'node:path';

/** Relative paths are from the project folder (the API itself runs from server/). */
const fromProject = (file: string) => path.resolve(import.meta.dirname, '../..', file);

/**
 * End-to-end test mode (browser tests only). When SENTRY_E2E_SITES is set, the listed pretend
 * websites (served on this machine by e2e/fixture-site.ts) can be checked, and their DNS TXT
 * records are read from SENTRY_E2E_TXT_FILE instead of real DNS. Every other website still goes
 * through the real SSRF guard and real DNS. It refuses to switch on in production.
 */
type E2eSite = { https: number; http: number; caFile: string };

function load(): Record<string, E2eSite> | null {
  const raw = process.env.SENTRY_E2E_SITES;
  if (!raw) return null;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SENTRY_E2E_SITES is for browser tests only and must not be set in production.');
  }
  const parsed = JSON.parse(raw) as Record<string, E2eSite>;
  // Only made-up names (.test can never exist on the internet), so a real website can't be redirected.
  const real = Object.keys(parsed).filter((hostname) => !hostname.endsWith('.test'));
  if (real.length > 0) {
    throw new Error(`SENTRY_E2E_SITES may only list .test names, not ${real.join(', ')}.`);
  }
  return parsed;
}

const sites = load();

export function e2eSite(hostname: string): (E2eSite & { ca: string }) | null {
  const site = sites?.[hostname];
  return site ? { ...site, ca: fs.readFileSync(fromProject(site.caFile), 'utf8') } : null;
}

/** TXT records the browser test has "published" for a pretend website. */
export function e2eTxtRecords(hostname: string): string[][] | null {
  if (!sites?.[hostname]) return null;
  const file = process.env.SENTRY_E2E_TXT_FILE;
  if (!file || !fs.existsSync(fromProject(file))) return [];
  const all = JSON.parse(fs.readFileSync(fromProject(file), 'utf8')) as Record<string, string[]>;
  return (all[hostname] ?? []).map((value) => [value]);
}
