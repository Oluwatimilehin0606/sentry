import { and, asc, count, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { domains, findings, scans } from '../db/schema.ts';
import type { CheckId } from '../scanner/catalog.ts';
import { buildReport, type ScanMode, type ScanReport } from '../scanner/scan.ts';

/** A finished check as stored: raw results only. The wording is added when it's read back. */
export async function saveScan(userId: string, report: ScanReport): Promise<string> {
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
  score: number;
  grade: string;
  scannedAt: string;
};

/** The account's checks, newest first, a page at a time (`before` = the last one already shown). */
export async function listScans(
  userId: string,
  opts: { hostname?: string; before?: Date; limit: number },
): Promise<{ scans: ScanSummary[]; more: boolean }> {
  const rows = await db
    .select({
      id: scans.id,
      hostname: scans.hostname,
      mode: scans.mode,
      score: scans.score,
      grade: scans.grade,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .where(
      and(
        eq(scans.userId, userId),
        eq(scans.status, 'done'),
        opts.hostname ? eq(scans.hostname, opts.hostname) : undefined,
        opts.before ? lt(scans.createdAt, opts.before) : undefined,
      ),
    )
    .orderBy(desc(scans.createdAt))
    .limit(opts.limit + 1);
  return {
    scans: rows.slice(0, opts.limit).map((r) => ({
      id: r.id,
      hostname: r.hostname,
      mode: r.mode,
      score: r.score ?? 0,
      grade: r.grade ?? 'F',
      scannedAt: r.createdAt.toISOString(),
    })),
    more: rows.length > opts.limit,
  };
}

/** One saved report, rebuilt with today's wording. Other people's reports read as missing. */
export async function getScan(userId: string, id: string): Promise<(ScanReport & { id: string }) | null> {
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
  return { id: row.id, ...report };
}

/** How many checks the account started since `since` (for the daily limit). */
export async function countScansSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(scans)
    .where(and(eq(scans.userId, userId), gte(scans.createdAt, since)));
  return row?.n ?? 0;
}
