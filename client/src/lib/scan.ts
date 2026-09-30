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
  /** The exact technical setting, for whoever runs the site. */
  forDeveloper?: string;
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

/** The four parts of a check, in the order the home page lists them. */
export const SCAN_STEPS = ['connection', 'certificate', 'protections', 'files'] as const;
export type ScanStep = (typeof SCAN_STEPS)[number];
/** "done" means the part was checked (not that it passed); "skipped" means it couldn't run. */
export type ScanProgress = { step: ScanStep; status: 'done' | 'skipped'; note?: string };

type StreamLine =
  | ({ type: 'progress' } & ScanProgress)
  | { type: 'report'; report: ScanReport }
  | { type: 'error'; error: string };

const LOST = 'The connection to Sentry dropped before the check finished. Please try again.';

/** Reads the server's one-JSON-object-per-line stream, passing progress on until the report arrives. */
async function readStream(body: ReadableStream<Uint8Array>, onProgress: (p: ScanProgress) => void): Promise<ScanReport> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new ScanError(LOST);
    }
    if (chunk.done) throw new ScanError(LOST);
    buffered += decoder.decode(chunk.value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const text of lines) {
      if (!text.trim()) continue;
      const line = JSON.parse(text) as StreamLine;
      if (line.type === 'progress') onProgress({ step: line.step, status: line.status, note: line.note });
      else if (line.type === 'error') throw new ScanError(line.error);
      else {
        void reader.cancel();
        return line.report;
      }
    }
  }
}

export async function runScan(domain: string, onProgress: (p: ScanProgress) => void = () => {}): Promise<ScanReport> {
  let res: Response;
  try {
    res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
      body: JSON.stringify({ domain }),
    });
  } catch {
    throw new ScanError('We couldn’t reach the Sentry server. Check it’s running and try again.');
  }
  if (res.ok && res.body && res.headers.get('content-type')?.includes('application/x-ndjson')) {
    return readStream(res.body, onProgress);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body?.error) throw new ScanError(body.error);
    if (res.status === 401) throw new ScanError('Your session has ended. Please sign in again.');
    if (res.status >= 500)
      throw new ScanError('Sentry’s server couldn’t be reached just now. Please try again in a moment.');
    throw new ScanError('Something went wrong. Please try again.');
  }
  return body as ScanReport;
}
