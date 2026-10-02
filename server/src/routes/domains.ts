import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { domains, scans } from '../db/schema.ts';
import { hasVerifyRecord, newVerifyToken, TXT_PREFIX } from '../domains/verify.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { firstCheckAt } from '../schedule/plan.ts';
import { runAutomaticCheck } from '../schedule/runner.ts';
import { normalizeHostname } from '../scanner/domain.ts';
import { DAILY_LIMIT } from './scan.ts';

export const domainsRouter = Router();
domainsRouter.use(requireAuth);

const MAX_DOMAINS = 20;

type DomainRow = typeof domains.$inferSelect;

/** What the website needs, including the record to add (only ever sent to its owner). */
function present(row: DomainRow) {
  return {
    id: row.id,
    hostname: row.hostname,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    rescanInterval: row.rescanInterval,
    nextCheckAt: row.nextCheckAt,
    alertsEnabled: row.alertsEnabled,
    record: { type: 'TXT', value: `${TXT_PREFIX}${row.verifyToken}` },
  };
}

domainsRouter.get('/', async (_req, res) => {
  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.userId, res.locals.user!.id))
    .orderBy(asc(domains.createdAt));
  res.json({ domains: rows.map(present) });
});

const AddBody = z.object({ domain: z.string().max(300) });

domainsRouter.post('/', async (req, res) => {
  const userId = res.locals.user!.id;
  const parsed = AddBody.safeParse(req.body);
  const hostname = parsed.success ? normalizeHostname(parsed.data.domain) : null;
  if (!hostname) {
    res.status(400).json({ error: 'Enter a valid domain, like yourbakery.com.' });
    return;
  }

  const [existing] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.userId, userId), eq(domains.hostname, hostname)));
  if (existing) {
    // Adding the same website twice just returns it, so the website can carry on to verifying.
    res.json({ domain: present(existing) });
    return;
  }

  const [counted] = await db.select({ total: count() }).from(domains).where(eq(domains.userId, userId));
  if ((counted?.total ?? 0) >= MAX_DOMAINS) {
    res.status(400).json({ error: `You can add up to ${MAX_DOMAINS} websites. Remove one to add another.` });
    return;
  }

  const [row] = await db
    .insert(domains)
    .values({ userId, hostname, verifyToken: newVerifyToken() })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    // Lost a race with a second click: return the one that won.
    const [again] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.userId, userId), eq(domains.hostname, hostname)));
    res.json({ domain: present(again!) });
    return;
  }
  res.status(201).json({ domain: present(row) });
});

const Id = z.uuid();

/** Finds one of the signed-in user's websites; other people's look exactly like missing ones. */
async function ownDomain(userId: string, id: string): Promise<DomainRow | undefined> {
  if (!Id.safeParse(id).success) return undefined;
  const [row] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, userId)));
  return row;
}

const NOT_FOUND = { error: 'We couldn’t find that website in your account.' };

domainsRouter.delete('/:id', async (req, res) => {
  const userId = res.locals.user!.id;
  const row = await ownDomain(userId, req.params.id);
  if (!row) {
    res.status(404).json(NOT_FOUND);
    return;
  }
  await db.delete(domains).where(and(eq(domains.id, row.id), eq(domains.userId, userId)));
  res.status(204).end();
});

const SettingsBody = z
  .object({
    rescanInterval: z.enum(['none', 'weekly', 'monthly']).optional(),
    alertsEnabled: z.boolean().optional(),
  })
  .strict();

/** Automatic checks and email alerts for one website. */
domainsRouter.patch('/:id', async (req, res) => {
  const userId = res.locals.user!.id;
  const row = await ownDomain(userId, String(req.params.id));
  if (!row) {
    res.status(404).json(NOT_FOUND);
    return;
  }
  const parsed = SettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Those settings weren’t valid.' });
    return;
  }
  const { rescanInterval, alertsEnabled } = parsed.data;
  // Automatic checks are full checks, so only for websites the account has proved it owns.
  if (rescanInterval && rescanInterval !== 'none' && !row.verifiedAt) {
    res.status(400).json({ error: `Prove ${row.hostname} is yours first, then you can turn on automatic checks.` });
    return;
  }

  const changes: Partial<typeof domains.$inferInsert> = {};
  if (alertsEnabled !== undefined) changes.alertsEnabled = alertsEnabled;
  if (rescanInterval !== undefined && rescanInterval !== row.rescanInterval) {
    changes.rescanInterval = rescanInterval;
    if (rescanInterval === 'none') changes.nextCheckAt = null;
    else {
      // Run at about the time of day of the website's last check.
      const [last] = await db
        .select({ at: scans.createdAt })
        .from(scans)
        .where(and(eq(scans.userId, userId), eq(scans.hostname, row.hostname), eq(scans.status, 'done')))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      changes.nextCheckAt = firstCheckAt(rescanInterval, last?.at ?? null, new Date());
    }
  }
  if (Object.keys(changes).length === 0) {
    res.json({ domain: present(row) });
    return;
  }
  const [updated] = await db.update(domains).set(changes).where(eq(domains.id, row.id)).returning();
  res.json({ domain: present(updated!) });
});

domainsRouter.post(
  '/:id/verify',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `verify:${res.locals.user!.id}`,
    message: { error: 'That’s a lot of checks in a short time. Please wait a minute and try again.' },
  }),
  async (req, res) => {
    const row = await ownDomain(res.locals.user!.id, String(req.params.id));
    if (!row) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    if (row.verifiedAt) {
      res.json({ verified: true, domain: present(row) });
      return;
    }

    const result = await hasVerifyRecord(row.hostname, row.verifyToken);
    if (!result.found) {
      res.json({ verified: false, reason: result.reason, domain: present(row) });
      return;
    }
    const [updated] = await db
      .update(domains)
      .set({ verifiedAt: new Date() })
      .where(eq(domains.id, row.id))
      .returning();
    res.json({ verified: true, domain: present(updated!) });
  },
);

/**
 * "Run it now" on a website's page: this period's automatic check, straight away. The same check
 * as the scheduler's (saved as "Automatic", alert email if it got worse), and it counts as this
 * period's check, so the next one moves to a week or a month from now.
 */
domainsRouter.post(
  '/:id/run-now',
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `run-now:${res.locals.user!.id}`,
    message: { error: 'That’s a lot of checks in a short time. Please wait a minute and try again.' },
  }),
  async (req, res) => {
    const userId = res.locals.user!.id;
    const row = await ownDomain(userId, String(req.params.id));
    if (!row) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    if (!row.verifiedAt || row.rescanInterval === 'none') {
      res.status(400).json({ error: `Turn on automatic checks for ${row.hostname} first.` });
      return;
    }

    // Move the next check on first, so the scheduler doesn't run the same check meanwhile.
    const [moved] = await db
      .update(domains)
      .set({
        nextCheckAt: sql`now() + case ${domains.rescanInterval} when 'weekly' then interval '7 days' else interval '1 month' end`,
      })
      .where(eq(domains.id, row.id))
      .returning();

    const result = await runAutomaticCheck({
      id: row.id,
      user_id: userId,
      hostname: row.hostname,
      rescan_interval: row.rescanInterval,
      alerts_enabled: row.alertsEnabled,
    });
    if (result.outcome === 'skipped') {
      // The only reason to skip: the daily limit. Put the next check back as it was.
      await db.update(domains).set({ nextCheckAt: row.nextCheckAt }).where(eq(domains.id, row.id));
      res.status(429).json({ error: `You’ve run ${DAILY_LIMIT} checks in the last 24 hours. Please try again tomorrow.` });
      return;
    }
    if (result.outcome === 'failed') {
      res.status(502).json({
        error: `We couldn’t reach ${row.hostname} just now. Check it’s online, then try again.`,
        domain: present(moved!),
      });
      return;
    }
    res.json({
      result: {
        outcome: result.outcome,
        scanId: result.scanId,
        previous: result.previous ?? null,
        current: result.current,
        emailedTo: result.emailedTo ?? null,
      },
      domain: present(moved!),
    });
  },
);
