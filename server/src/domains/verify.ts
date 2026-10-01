import { randomBytes } from 'node:crypto';
import dns from 'node:dns';
import { e2eTxtRecords } from '../e2e.ts';

/**
 * Ownership proof: the user adds a DNS TXT record "sentry-verify=<token>" to their domain.
 * Only someone who controls the domain's DNS can do that, and each token belongs to one
 * account, so it can't be guessed or borrowed from another user.
 */
export const TXT_PREFIX = 'sentry-verify=';

export function newVerifyToken(): string {
  return randomBytes(8).toString('hex');
}

export type TxtCheck = { found: true } | { found: false; reason: 'not_found' | 'no_domain' | 'dns_error' };

async function lookupTxt(hostname: string): Promise<string[][] | Exclude<TxtCheck, { found: true }>> {
  // Browser tests "publish" records for their pretend websites in a file instead.
  const fake = e2eTxtRecords(hostname);
  if (fake) return fake;
  try {
    // Called through dns.promises at call time so tests can stand in for real DNS.
    return await dns.promises.resolveTxt(hostname);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // ENODATA: the name exists but has no TXT records yet, which is the usual "not added yet".
    if (code === 'ENODATA') return { found: false, reason: 'not_found' };
    if (code === 'ENOTFOUND') return { found: false, reason: 'no_domain' };
    return { found: false, reason: 'dns_error' };
  }
}

export async function hasVerifyRecord(hostname: string, token: string): Promise<TxtCheck> {
  const records = await lookupTxt(hostname);
  if (!Array.isArray(records)) return records;
  // Long TXT values arrive split into chunks; providers also sometimes keep the quotes.
  const expected = `${TXT_PREFIX}${token}`;
  const found = records.some((chunks) => chunks.join('').trim().replace(/^"|"$/g, '') === expected);
  return found ? { found: true } : { found: false, reason: 'not_found' };
}

/**
 * A verified domain also covers its subdomains: whoever controls yourbakery.com's DNS controls
 * shop.yourbakery.com too. The reverse isn't true, so a verified subdomain covers only itself.
 */
export function covers(verifiedHostname: string, hostname: string): boolean {
  return hostname === verifiedHostname || hostname.endsWith(`.${verifiedHostname}`);
}
