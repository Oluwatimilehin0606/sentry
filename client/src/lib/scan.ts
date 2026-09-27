export type Severity = 'critical' | 'medium' | 'low';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export type ReportFinding = {
  checkId: string;
  status: 'pass' | 'fail';
  severity: Severity;
  title: string;
  whatItIs: string;
  whyItMatters: string;
  howToFix: string;
  evidence?: string;
};

export type ScanReport = {
  hostname: string;
  finalUrl?: string;
  scannedAt: string;
  durationMs: number;
  score: number;
  grade: Grade;
  summary: string;
  findings: ReportFinding[];
};

export class ScanError extends Error {}

export async function runScan(domain: string): Promise<ScanReport> {
  let res: Response;
  try {
    res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
  } catch {
    throw new ScanError('We couldn’t reach the Sentry server. Check it’s running and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ScanError(body?.error ?? 'Something went wrong. Please try again.');
  return body as ScanReport;
}
