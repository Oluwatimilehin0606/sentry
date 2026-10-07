import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { user } from '../db/schema.ts';
import { sendReportToDeveloper } from '../developer/send.ts';
import { alertEmail } from '../email/alert.ts';
import { sendEmail as defaultSend, type SendEmail } from '../email/mailer.ts';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { DAILY_LIMIT } from '../routes/scan.ts';
import { CATALOG, type CheckId } from '../scanner/catalog.ts';
import { contextFor, type ScanContext } from '../scanner/context.ts';
import { scanHost } from '../scanner/scan.ts';
import { countScansSince, getScan, saveScan } from '../scans/store.ts';
import { shouldAlert } from './plan.ts';

export type Due = {
  id: string;
  user_id: string;
  hostname: string;
  rescan_interval: 'weekly' | 'monthly';
  alerts_enabled: boolean;
  /** "Send to my developer": whoever built the website, if saved, and whether to send automatically. */
  developer_name?: string | null;
  developer_email?: string | null;
  developer_auto_send?: boolean;
  developer_stop_token?: string | null;
};

export type RunOptions = {
  now?: Date;
  /** How to reach a website (tests point this at the local fixture site). */
  contextFor?: (hostname: string) => ScanContext;
  send?: SendEmail;
  /** Websites to check per run; the rest wait for the next minute. */
  batch?: number;
};

export type RunResult = { hostname: string; outcome: 'checked' | 'alerted' | 'skipped' | 'failed'; reason?: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Claims the websites whose automatic check is due and moves each one's next check on by its
 * interval, in one statement. SKIP LOCKED means two copies of the server never claim the same
 * website, and moving the time first means a crash mid-check can't cause a burst of retries.
 */
async function claimDue(now: Date, batch: number): Promise<Due[]> {
  const result = await db.execute<Due>(sql`
    update domains
    set next_check_at = ${now}::timestamptz + case rescan_interval when 'weekly' then interval '7 days' else interval '1 month' end
    where id in (
      select id from domains
      where rescan_interval <> 'none' and verified_at is not null and next_check_at <= ${now}
      order by next_check_at
      limit ${batch}
      for update skip locked
    )
    returning id, user_id, hostname, rescan_interval, alerts_enabled,
      developer_name, developer_email, developer_auto_send, developer_stop_token
  `);
  return result.rows;
}

/** What one automatic check found, for the website page's "Run it now". */
export type CheckOutcome = {
  hostname: string;
  outcome: 'checked' | 'alerted' | 'skipped' | 'failed';
  reason?: string;
  scanId?: string;
  previous?: { grade: string; score: number } | null;
  current?: { grade: string; score: number };
  /** Set when the alert email went out. */
  emailedTo?: string;
  /** Set when the report also went to the website's developer. */
  developerEmailed?: string;
};

/**
 * Runs one website's automatic check: the full check, saved as "Automatic", and the alert email
 * if things got worse. Used by the scheduler and by "Run it now" on the website's page.
 */
export async function runAutomaticCheck(due: Due, opts: RunOptions = {}): Promise<CheckOutcome> {
  const now = opts.now ?? new Date();
  const reach = opts.contextFor ?? contextFor;
  const send = opts.send ?? defaultSend;

  // Automatic checks count towards the same daily limit as checks people start.
  if ((await countScansSince(due.user_id, new Date(now.getTime() - DAY_MS))) >= DAILY_LIMIT) {
    return { hostname: due.hostname, outcome: 'skipped', reason: 'daily limit' };
  }
  let id: string;
  try {
    const report = await scanHost(due.hostname, reach(due.hostname), undefined, 'full');
    id = await saveScan(due.user_id, report, 'scheduled');
  } catch (err) {
    logger.warn({ hostname: due.hostname, err: (err as Error).message }, 'Automatic check failed');
    return { hostname: due.hostname, outcome: 'failed', reason: (err as Error).message };
  }

  const saved = await getScan(due.user_id, id);
  const changes = saved?.changes;
  const result: CheckOutcome = {
    hostname: due.hostname,
    outcome: 'checked',
    scanId: id,
    previous: changes ? { grade: changes.previous.grade, score: changes.previous.score } : null,
    current: saved ? { grade: saved.grade, score: saved.score } : undefined,
  };
  const appeared = (changes?.appeared ?? []).map((checkId) => ({
    checkId,
    ...CATALOG[checkId as CheckId],
  }));
  const [owner] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, due.user_id));

  // The developer gets the report after every automatic check that finds a problem, if the owner
  // turned that on ("Send to my developer"). Independent of the owner's own alert below.
  if (saved && owner && due.developer_auto_send && due.developer_email && saved.findings.some((f) => f.status === 'fail')) {
    const developerSent = await sendReportToDeveloper({
      owner,
      developer: { name: due.developer_name ?? '', email: due.developer_email },
      report: saved,
      stopToken: due.developer_stop_token,
      send,
    }).catch((err) => {
      logger.warn({ hostname: due.hostname, err: (err as Error).message }, 'Report to developer could not be sent');
      return false;
    });
    if (developerSent) result.developerEmailed = due.developer_email;
  }

  if (
    !saved ||
    !changes ||
    !due.alerts_enabled ||
    !shouldAlert(
      changes.previous.grade,
      saved.grade,
      appeared.map((a) => a.severity),
    )
  ) {
    return result;
  }

  const email = alertEmail({
    hostname: due.hostname,
    interval: due.rescan_interval,
    previous: { grade: changes.previous.grade, score: changes.previous.score },
    current: { grade: saved.grade, score: saved.score, scannedAt: saved.scannedAt },
    appeared: appeared
      .filter((a) => a.severity !== 'low')
      .map((a) => ({ title: a.title, severity: a.severity })),
    reportUrl: `${env.APP_URL}/reports/${id}`,
    settingsUrl: `${env.APP_URL}/websites/${due.hostname}?alerts=off`,
    timeZone: env.APP_TIMEZONE,
  });
  const sent = owner ? await send({ to: owner.email, ...email }) : false;
  return sent
    ? { ...result, outcome: 'alerted', emailedTo: owner!.email }
    : { ...result, reason: 'email not sent' };
}

/** Runs every automatic check that's due. Called once a minute by the scheduler. */
export async function runDueChecks(opts: RunOptions = {}): Promise<RunResult> {
  const results: RunResult = [];
  for (const due of await claimDue(opts.now ?? new Date(), opts.batch ?? 5)) {
    const { hostname, outcome, reason } = await runAutomaticCheck(due, opts);
    results.push(reason ? { hostname, outcome, reason } : { hostname, outcome });
  }
  return results;
}

/** Checks for due websites every minute while the server runs (not in tests). */
export function startScheduler(intervalMs = 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // the previous run is still going
    running = true;
    try {
      const results = await runDueChecks();
      for (const r of results) logger.info(r, 'Automatic check');
    } catch (err) {
      logger.error({ err }, 'Automatic checks could not run');
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, 15_000);
  const timer = setInterval(tick, intervalMs);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
