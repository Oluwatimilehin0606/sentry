import type { IncomingHttpHeaders } from 'node:http';
import type { PeerCertificate } from 'node:tls';
import type { CheckId } from './catalog.ts';

export type Finding = {
  checkId: CheckId;
  status: 'pass' | 'fail';
  /** Short technical detail shown under the explanation. */
  evidence?: string;
};

const pass = (checkId: CheckId, evidence?: string): Finding => ({ checkId, status: 'pass', evidence });
const fail = (checkId: CheckId, evidence?: string): Finding => ({ checkId, status: 'fail', evidence });

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value.join(', ') : value;
}

/** Evaluates the security headers of the site's HTTPS homepage response. */
export function evaluateHeaders(headers: IncomingHttpHeaders): Finding[] {
  const findings: Finding[] = [];

  const hsts = header(headers, 'strict-transport-security');
  const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? '')?.[1] ?? 0);
  findings.push(
    hsts && maxAge > 0
      ? pass('header.hsts_missing', `Strict-Transport-Security: ${hsts}`)
      : fail('header.hsts_missing', hsts ? `max-age is 0: ${hsts}` : 'Strict-Transport-Security not set'),
  );

  const csp = header(headers, 'content-security-policy');
  findings.push(
    csp
      ? pass('header.csp_missing', 'Content-Security-Policy is set')
      : fail('header.csp_missing', 'Content-Security-Policy not set'),
  );

  const xfo = header(headers, 'x-frame-options');
  const frameAncestors = /frame-ancestors/i.test(csp ?? '');
  findings.push(
    xfo || frameAncestors
      ? pass('header.xfo_missing', xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors is set')
      : fail('header.xfo_missing', 'Neither X-Frame-Options nor CSP frame-ancestors is set'),
  );

  const xcto = header(headers, 'x-content-type-options');
  findings.push(
    xcto?.toLowerCase().includes('nosniff')
      ? pass('header.xcto_missing', `X-Content-Type-Options: ${xcto}`)
      : fail('header.xcto_missing', 'X-Content-Type-Options: nosniff not set'),
  );

  const referrer = header(headers, 'referrer-policy');
  findings.push(
    referrer
      ? pass('header.referrer_policy_missing', `Referrer-Policy: ${referrer}`)
      : fail('header.referrer_policy_missing', 'Referrer-Policy not set'),
  );

  const leaks = ['server', 'x-powered-by', 'x-aspnet-version']
    .map((name) => [name, header(headers, name)] as const)
    .filter(([, value]) => value && /\d/.test(value));
  findings.push(
    leaks.length > 0
      ? fail('header.server_version_leak', leaks.map(([n, v]) => `${n}: ${v}`).join(' · '))
      : pass('header.server_version_leak'),
  );

  return findings;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateCertificate(cert: PeerCertificate | undefined, now = new Date()): Finding[] {
  if (!cert?.valid_to) return [];
  const expires = new Date(cert.valid_to);
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / DAY_MS);
  const when = expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    daysLeft < 14
      ? fail('tls.cert_expiring_soon', `Expires ${when} (${daysLeft} days left)`)
      : pass('tls.cert_expiring_soon', `Valid until ${when} (${daysLeft} days left)`),
  ];
}

/** Turns a TLS connection error into a finding, or returns null for non-TLS errors. */
export function evaluateTlsError(err: NodeJS.ErrnoException): Finding | null {
  switch (err.code) {
    case 'CERT_HAS_EXPIRED':
      return fail('tls.cert_invalid', 'The certificate has expired');
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return fail('tls.cert_invalid', 'The certificate was issued for a different domain');
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return fail('tls.cert_invalid', 'The certificate is self-signed, so browsers don’t trust it');
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
      return fail('tls.cert_invalid', 'The certificate chain is incomplete or untrusted');
    case 'CERT_NOT_YET_VALID':
      return fail('tls.cert_invalid', 'The certificate isn’t valid yet');
    default:
      return null;
  }
}
