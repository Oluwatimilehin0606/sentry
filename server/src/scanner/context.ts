import type { LookupFunction } from 'node:net';
import { e2eSite } from '../e2e.ts';
import { assertPublicHost, guardedLookup } from './target.ts';

/** Total time allowed for one scan, from first DNS lookup to report. */
export const SCAN_BUDGET_MS = 60_000;

/** How the scanner reaches a site. Real scans always use `publicContext`. */
export type ScanContext = {
  /** DNS lookup for every connection (the SSRF guard lives here). */
  lookup: LookupFunction;
  /** Checked once before the scan starts. */
  assertTarget: (hostname: string) => Promise<void>;
  /** Extra trusted certificate authority (tests only). */
  ca?: string;
  ports: { https: number; http: number };
  /** Time (ms since epoch) after which optional checks are skipped. */
  deadline: number;
};

export function publicContext(now = Date.now()): ScanContext {
  return {
    lookup: guardedLookup,
    assertTarget: assertPublicHost,
    ports: { https: 443, http: 80 },
    deadline: now + SCAN_BUDGET_MS - 5_000,
  };
}

/**
 * For the local fixture server in tests: connects to this machine only (the reverse of the real
 * guard), on the fixture's ports, trusting the fixture's test certificate authority.
 */
export function fixtureContext(opts: {
  httpsPort: number;
  httpPort: number;
  ca: string;
  /** The name the fixture is served as (default localhost). */
  hostname?: string;
}): ScanContext {
  const served = opts.hostname ?? 'localhost';
  const loopbackOnly: LookupFunction = (hostname, options, callback) => {
    if (hostname !== served) return callback(new Error(`The fixture is only served as ${served}`), '');
    if (options.all) return callback(null, [{ address: '127.0.0.1', family: 4 }]);
    callback(null, '127.0.0.1', 4);
  };
  return {
    lookup: loopbackOnly,
    assertTarget: async () => {},
    ca: opts.ca,
    ports: { https: opts.httpsPort, http: opts.httpPort },
    deadline: Date.now() + SCAN_BUDGET_MS,
  };
}

/** The context for a real check: the public one, except for browser-test pretend websites. */
export function contextFor(hostname: string): ScanContext {
  const site = e2eSite(hostname);
  return site
    ? fixtureContext({ hostname, httpsPort: site.https, httpPort: site.http, ca: site.ca })
    : publicContext();
}

/** Builds a URL for the site on the context's ports (defaults are left out). */
export function siteUrl(ctx: ScanContext, protocol: 'https' | 'http', hostname: string, path = '/'): URL {
  const port = ctx.ports[protocol];
  const isDefault = port === (protocol === 'https' ? 443 : 80);
  return new URL(`${protocol}://${hostname}${isDefault ? '' : `:${port}`}${path}`);
}
