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

/** What changed since the same website's previous check (null for its first check). */
export type ReportChanges = {
  previous: { id: string; scannedAt: string; score: number; grade: Grade };
  fixed: { checkId: string; title: string }[];
  appeared: string[];
  stillFailing: number;
};

export type ScanReport = {
  /** Set once the check is saved (every finished check is). */
  id?: string;
  hostname: string;
  /** "light" = what any browser sees; "full" adds private files (verified owners only). */
  mode: 'full' | 'light';
  finalUrl?: string;
  scannedAt: string;
  durationMs: number;
  score: number;
  grade: Grade;
  summary: string;
  findings: ReportFinding[];
  /** Present on saved reports (every finished check is saved). */
  changes?: ReportChanges | null;
  /** "scheduled" = an automatic check. */
  trigger?: 'manual' | 'scheduled';
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

/**
 * How long to wait for the next line before giving up. A check stops itself after 60 seconds,
 * so silence beyond that means the connection is gone (for example, the server restarted) even
 * if the browser hasn't noticed. Once every part has finished, the report follows within moments.
 */
const SILENCE_MS = 75_000;
const AFTER_LAST_STEP_MS = 15_000;

/** Reads the server's one-JSON-object-per-line stream, passing progress on until the report arrives. */
async function readStream(body: ReadableStream<Uint8Array>, onProgress: (p: ScanProgress) => void): Promise<ScanReport> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const finished = new Set<ScanStep>();
  let buffered = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array> | 'silent';
    let timer: number | undefined;
    const silence = new Promise<'silent'>((resolve) => {
      timer = window.setTimeout(() => resolve('silent'), finished.size === SCAN_STEPS.length ? AFTER_LAST_STEP_MS : SILENCE_MS);
    });
    try {
      chunk = await Promise.race([reader.read(), silence]);
    } catch {
      throw new ScanError(LOST);
    } finally {
      window.clearTimeout(timer);
    }
    if (chunk === 'silent') {
      void reader.cancel();
      throw new ScanError(LOST);
    }
    if (chunk.done) throw new ScanError(LOST);
    buffered += decoder.decode(chunk.value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const text of lines) {
      if (!text.trim()) continue;
      const line = JSON.parse(text) as StreamLine;
      if (line.type === 'progress') {
        finished.add(line.step);
        onProgress({ step: line.step, status: line.status, note: line.note });
      }
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
