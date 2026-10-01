import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { domains, findings, scans } from '../db/schema.ts';
import { CATALOG, type CheckId } from '../scanner/catalog.ts';
import { diffChecks } from './diff.ts';
import { buildReport, type ScanMode, type ScanReport } from '../scanner/scan.ts';

/** A finished check as stored: raw results only. The wording is added when it's read back. */
export type Trigger = 'manual' | 'scheduled';

export async function saveScan(userId: string, report: ScanReport, trigger: Trigger = 'manual'): Promise<string> {
  return db.transaction(async (tx) => {
    const [site] = await tx
      .select({ id: domains.id })
      .from(domains)
      .where(and(eq(domains.userId, userId), eq(domains.hostname, report.hostname)));
    const finishedAt = new Date(report.scannedAt);
    const [row] = await tx
      .insert(scans)
      .values({
        userId,
        hostname: report.hostname,
        domainId: site?.id ?? null,
        mode: report.mode,
        trigger,
        status: 'done',
        score: report.score,
        grade: report.grade,
        finalUrl: report.finalUrl ?? null,
        durationMs: report.durationMs,
        startedAt: new Date(finishedAt.getTime() - report.durationMs),
        finishedAt,
        createdAt: finishedAt,
      })
      .returning({ id: scans.id });
    if (report.findings.length > 0) {
      await tx.insert(findings).values(
        report.findings.map((f) => ({
          scanId: row!.id,
          checkId: f.checkId,
          status: f.status,
          severity: f.severity,
          evidence: f.evidence ?? null,
        })),
      );
    }
    return row!.id;
  });
}

export type ScanSummary = {
  id: string;
  hostname: string;
  mode: ScanMode;
  trigger: Trigger;
  score: number;
  grade: string;
  scannedAt: string;
  /** Compared with the previous check of the same website; null for the first. */
  change: { scoreDelta: number; fixed: number; appeared: number } | null;
};

type Result = { checkId: CheckId; status: 'pass' | 'fail' };

/** Pass/fail results of several checks at once. */
async function resultsFor(scanIds: string[]): Promise<Map<string, Result[]>> {
  const byScan = new Map<string, Result[]>();
  if (scanIds.length === 0) return byScan;
  const rows = await db
    .select({ scanId: findings.scanId, checkId: findings.checkId, status: findings.status })
    .from(findings)
    .where(inArray(findings.scanId, scanIds));
  for (const r of rows) {
    const list = byScan.get(r.scanId) ?? [];
    list.push({ checkId: r.checkId as CheckId, status: r.status });
    byScan.set(r.scanId, list);
  }
  return byScan;
}

/** The account's checks, newest first, a page at a time (`before` = the last one already shown). */
export async function listScans(
  userId: string,
  opts: { hostname?: string; before?: Date; limit: number },
): Promise<{ scans: ScanSummary[]; more: boolean }> {
  // Each check next to the same website's check before it. The window function runs over all of
  // the account's checks (inner query); paging happens outside it, so the oldest row on a page
  // still finds its previous check.
  const ranked = db
    .select({
      id: scans.id,
      hostname: scans.hostname,
      mode: scans.mode,
      trigger: scans.trigger,
      score: scans.score,
      grade: scans.grade,
      createdAt: scans.createdAt,
      previousId: sql<string | null>`lag(${scans.id}) over (partition by ${scans.hostname} order by ${scans.createdAt})`.as(
        'previous_id',
      ),
      previousScore: sql<number | null>`lag(${scans.score}) over (partition by ${scans.hostname} order by ${scans.createdAt})`.as(
        'previous_score',
      ),
    })
    .from(scans)
    .where(and(eq(scans.userId, userId), eq(scans.status, 'done'), opts.hostname ? eq(scans.hostname, opts.hostname) : undefined))
    .as('ranked');
  const rows = await db
    .select()
    .from(ranked)
    .where(opts.before ? lt(ranked.createdAt, opts.before) : undefined)
    .orderBy(desc(ranked.createdAt))
    .limit(opts.limit + 1);
  const page = rows.slice(0, opts.limit);
  const results = await resultsFor(page.flatMap((r) => (r.previousId ? [r.id, r.previousId] : [])));
  return {
    scans: page.map((r) => {
      const changes = r.previousId ? diffChecks(results.get(r.previousId) ?? [], results.get(r.id) ?? []) : null;
      return {
        id: r.id,
        hostname: r.hostname,
        mode: r.mode,
        trigger: r.trigger,
        score: r.score ?? 0,
        grade: r.grade ?? 'F',
        scannedAt: r.createdAt.toISOString(),
        change: changes
          ? {
              scoreDelta: (r.score ?? 0) - (r.previousScore ?? 0),
              fixed: changes.fixed.length,
              appeared: changes.appeared.length,
            }
          : null,
      };
    }),
    more: rows.length > opts.limit,
  };
}

/** What changed since the same website's previous check, as shown at the top of a report. */
export type ReportChanges = {
  previous: { id: string; scannedAt: string; score: number; grade: string };
  fixed: { checkId: CheckId; title: string }[];
  appeared: CheckId[];
  stillFailing: number;
};

export type SavedReport = ScanReport & { id: string; trigger: Trigger; changes: ReportChanges | null };

/** One saved report, rebuilt with today's wording. Other people's reports read as missing. */
export async function getScan(userId: string, id: string): Promise<SavedReport | null> {
  const [row] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.id, id), eq(scans.userId, userId), eq(scans.status, 'done')));
  if (!row) return null;
  const rows = await db.select().from(findings).where(eq(findings.scanId, row.id)).orderBy(asc(findings.id));
  const report = buildReport({
    hostname: row.hostname,
    mode: row.mode,
    finalUrl: row.finalUrl ?? undefined,
    scannedAt: (row.finishedAt ?? row.createdAt).toISOString(),
    durationMs: row.durationMs ?? 0,
    findings: rows.map((f) => ({
      checkId: f.checkId as CheckId,
      status: f.status,
      evidence: typeof f.evidence === 'string' ? f.evidence : undefined,
    })),
  });

  const [previous] = await db
    .select()
    .from(scans)
    .where(
      and(
        eq(scans.userId, userId),
        eq(scans.hostname, row.hostname),
        eq(scans.status, 'done'),
        lt(scans.createdAt, row.createdAt),
      ),
    )
    .orderBy(desc(scans.createdAt))
    .limit(1);
  let changes: ReportChanges | null = null;
  if (previous) {
    const before = (await resultsFor([previous.id])).get(previous.id) ?? [];
    // The report's own order (severity, then catalog), so "fixed" always lists in the same order.
    const diff = diffChecks(
      before,
      report.findings.map((f) => ({ checkId: f.checkId as CheckId, status: f.status })),
    );
    changes = {
      previous: {
        id: previous.id,
        scannedAt: (previous.finishedAt ?? previous.createdAt).toISOString(),
        score: previous.score ?? 0,
        grade: previous.grade ?? 'F',
      },
      fixed: diff.fixed.map((checkId) => ({ checkId, title: CATALOG[checkId].passTitle })),
      appeared: diff.appeared,
      stillFailing: diff.stillFailing.length,
    };
  }
  return { id: row.id, ...report, trigger: row.trigger, changes };
}

/** How many checks the account started since `since` (for the daily limit). */
export async function countScansSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(scans)
    .where(and(eq(scans.userId, userId), gte(scans.createdAt, since)));
  return row?.n ?? 0;
}
