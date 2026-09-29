import { CATALOG } from './catalog.ts';
import {
  evaluateCertificate,
  evaluateHeaders,
  evaluateTlsError,
  type Finding,
} from './checks.ts';
import { publicContext, SCAN_BUDGET_MS, siteUrl, type ScanContext } from './context.ts';
import { fetchUrl, type HttpResult } from './http.ts';
import { checkLegacyTls } from './legacy-tls.ts';
import { probePaths } from './paths.ts';
import { scoreFindings } from './score.ts';
import { ScanTargetError } from './target.ts';

const MAX_REDIRECTS = 3;

/** The four parts of a scan the home page shows ticking off, in display order. */
export const SCAN_STEPS = ['connection', 'certificate', 'protections', 'files'] as const;
export type ScanStep = (typeof SCAN_STEPS)[number];
/** "done" means the part was checked (not that it passed); "skipped" means it couldn't run. */
export type ScanProgress = { step: ScanStep; status: 'done' | 'skipped'; note?: string };
export type OnProgress = (progress: ScanProgress) => void;
const SEVERITY_RANK = { critical: 0, medium: 1, low: 2 } as const;

/** Only follow redirects that stay on the same site (e.g. example.com → www.example.com/en). */
function isSameSite(target: URL, hostname: string): boolean {
  const host = target.hostname.toLowerCase();
  return host === hostname || host === `www.${hostname}` || `www.${host}` === hostname;
}

async function fetchHomepage(ctx: ScanContext, hostname: string): Promise<HttpResult> {
  let url = siteUrl(ctx, 'https', hostname);
  for (let hop = 0; ; hop++) {
    const res = await fetchUrl(ctx, url);
    const location = res.headers.location;
    if (res.status < 300 || res.status >= 400 || !location || hop >= MAX_REDIRECTS) return res;
    const next = new URL(location, url);
    if (next.protocol !== 'https:' || !isSameSite(next, hostname)) return res;
    url = next;
  }
}

const HTTP_CLOSED = 'Plain HTTP (port 80) is closed';

async function checkHttpRedirect(ctx: ScanContext, hostname: string): Promise<Finding> {
  try {
    const res = await fetchUrl(ctx, siteUrl(ctx, 'http', hostname));
    const location = res.headers.location ?? '';
    if (res.status >= 300 && res.status < 400 && location.startsWith('https://')) {
      return { checkId: 'http.no_https_redirect', status: 'pass', evidence: `http:// → ${res.status} → ${location}` };
    }
    return {
      checkId: 'http.no_https_redirect',
      status: 'fail',
      evidence: `http://${hostname}/ answered ${res.status} without redirecting to https://`,
    };
  } catch {
    // Nothing served over plain HTTP at all, so there's nothing insecure to redirect.
    return { checkId: 'http.no_https_redirect', status: 'pass', evidence: HTTP_CLOSED };
  }
}

/** Where to look for exposed files: the secure homepage, or plain HTTP if that's all that works. */
function probeOrigin(ctx: ScanContext, hostname: string, home: HttpResult | null, httpCheck: Finding): URL | null {
  if (home) return new URL(home.url.origin);
  if (httpCheck.status === 'fail') return new URL(siteUrl(ctx, 'http', hostname).origin);
  return null;
}

export function scanHost(hostname: string, ctx: ScanContext = publicContext(), onProgress: OnProgress = () => {}) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ScanTargetError('TIMEOUT', `Checking ${hostname} took too long. The site may be slow right now; try again in a few minutes.`)),
      SCAN_BUDGET_MS,
    );
  });
  return Promise.race([runScan(hostname, ctx, onProgress), timeout]).finally(() => clearTimeout(timer));
}

async function runScan(hostname: string, ctx: ScanContext, onProgress: OnProgress) {
  const started = Date.now();
  await ctx.assertTarget(hostname);

  const findings: Finding[] = [];
  let finalUrl: string | undefined;
  let home: HttpResult | null = null;
  let httpsAnswered = false;

  try {
    home = await fetchHomepage(ctx, hostname);
    httpsAnswered = true;
    finalUrl = home.url.href;
    findings.push(
      { checkId: 'tls.no_https', status: 'pass', evidence: `${siteUrl(ctx, 'https', hostname).href} answered ${home.status}` },
      { checkId: 'tls.cert_invalid', status: 'pass', evidence: home.certificate?.issuer?.O ? `Issued by ${home.certificate.issuer.O}` : undefined },
      ...evaluateCertificate(home.certificate),
      ...evaluateHeaders(home.headers),
    );
  } catch (err) {
    if (err instanceof ScanTargetError) throw err;
    const tlsFinding = evaluateTlsError(err as NodeJS.ErrnoException);
    if (tlsFinding) {
      httpsAnswered = true;
      findings.push({ checkId: 'tls.no_https', status: 'pass' }, tlsFinding);
    }
  }

  const httpCheck = await checkHttpRedirect(ctx, hostname);
  if (!httpsAnswered) {
    // HTTPS didn't answer at all. If plain HTTP doesn't either, the site is simply down.
    if (httpCheck.evidence === HTTP_CLOSED) {
      throw new ScanTargetError('UNREACHABLE', `We couldn’t reach ${hostname}. Check the website is online and try again.`);
    }
    findings.push({ checkId: 'tls.no_https', status: 'fail', evidence: `https://${hostname}/ didn’t answer` });
  } else {
    findings.push(httpCheck);
  }

  // The homepage visit settles the certificate and the browser protections.
  onProgress(
    httpsAnswered
      ? { step: 'certificate', status: 'done' }
      : { step: 'certificate', status: 'skipped', note: 'no secure connection' },
  );
  onProgress(
    home
      ? { step: 'protections', status: 'done' }
      : { step: 'protections', status: 'skipped', note: httpsAnswered ? 'certificate not trusted' : 'no secure connection' },
  );

  // The slower checks run side by side.
  const origin = probeOrigin(ctx, hostname, home, httpCheck);
  const [legacy, paths] = await Promise.all([
    (httpsAnswered ? checkLegacyTls(ctx, hostname) : Promise.resolve(null)).then((result) => {
      onProgress({ step: 'connection', status: 'done' });
      return result;
    }),
    (origin ? probePaths(ctx, origin) : Promise.resolve([])).then((result) => {
      onProgress(
        result.length > 0
          ? { step: 'files', status: 'done' }
          : { step: 'files', status: 'skipped', note: origin ? 'site didn’t answer' : 'no connection we could use' },
      );
      return result;
    }),
  ]);
  if (legacy) findings.push(legacy);
  findings.push(...paths);

  const { score, grade, summary } = scoreFindings(findings);

  const detailed = findings
    .map((f) => {
      const entry = CATALOG[f.checkId];
      return {
        checkId: f.checkId,
        status: f.status,
        severity: entry.severity,
        title: f.status === 'fail' ? entry.title : entry.passTitle,
        whatItIs: entry.whatItIs,
        whyItMatters: entry.whyItMatters,
        howToFix: entry.howToFix,
        evidence: f.evidence,
      };
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return {
    hostname,
    finalUrl,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    score,
    grade,
    summary,
    findings: detailed,
  };
}

export type ScanReport = Awaited<ReturnType<typeof runScan>>;
