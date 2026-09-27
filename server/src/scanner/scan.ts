import { CATALOG } from './catalog.ts';
import {
  evaluateCertificate,
  evaluateHeaders,
  evaluateTlsError,
  type Finding,
} from './checks.ts';
import { fetchHead, type HttpResult } from './http.ts';
import { scoreFindings } from './score.ts';
import { assertPublicHost, ScanTargetError } from './target.ts';

const MAX_REDIRECTS = 3;
const SEVERITY_RANK = { critical: 0, medium: 1, low: 2 } as const;

/** Only follow redirects that stay on the same site (e.g. example.com → www.example.com/en). */
function isSameSite(target: URL, hostname: string): boolean {
  const host = target.hostname.toLowerCase();
  return host === hostname || host === `www.${hostname}` || `www.${host}` === hostname;
}

async function fetchHomepage(hostname: string): Promise<HttpResult> {
  let url = new URL(`https://${hostname}/`);
  for (let hop = 0; ; hop++) {
    const res = await fetchHead(url);
    const location = res.headers.location;
    if (res.status < 300 || res.status >= 400 || !location || hop >= MAX_REDIRECTS) return res;
    const next = new URL(location, url);
    if (next.protocol !== 'https:' || !isSameSite(next, hostname)) return res;
    url = next;
  }
}

async function checkHttpRedirect(hostname: string): Promise<Finding> {
  try {
    const res = await fetchHead(new URL(`http://${hostname}/`));
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
    return { checkId: 'http.no_https_redirect', status: 'pass', evidence: 'Plain HTTP (port 80) is closed' };
  }
}

export async function scanHost(hostname: string) {
  const started = Date.now();
  await assertPublicHost(hostname);

  const findings: Finding[] = [];
  let finalUrl: string | undefined;

  try {
    const home = await fetchHomepage(hostname);
    finalUrl = home.url.href;
    findings.push(
      { checkId: 'tls.no_https', status: 'pass', evidence: `https://${hostname}/ answered ${home.status}` },
      { checkId: 'tls.cert_invalid', status: 'pass', evidence: home.certificate?.issuer?.O ? `Issued by ${home.certificate.issuer.O}` : undefined },
      ...evaluateCertificate(home.certificate),
      ...evaluateHeaders(home.headers),
    );
    findings.push(await checkHttpRedirect(hostname));
  } catch (err) {
    if (err instanceof ScanTargetError) throw err;
    const tlsFinding = evaluateTlsError(err as NodeJS.ErrnoException);
    if (tlsFinding) {
      findings.push({ checkId: 'tls.no_https', status: 'pass' }, tlsFinding);
    } else {
      // HTTPS didn't answer at all. If plain HTTP doesn't either, the site is simply down.
      const httpCheck = await checkHttpRedirect(hostname);
      if (httpCheck.evidence === 'Plain HTTP (port 80) is closed') {
        throw new ScanTargetError(
          'UNREACHABLE',
          `We couldn’t reach ${hostname}. Check the website is online and try again.`,
        );
      }
      findings.push({
        checkId: 'tls.no_https',
        status: 'fail',
        evidence: `https://${hostname}/ didn’t answer (${(err as NodeJS.ErrnoException).code ?? 'no response'})`,
      });
    }
  }

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

export type ScanReport = Awaited<ReturnType<typeof scanHost>>;
