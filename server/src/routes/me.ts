import { and, asc, count, desc, eq, gt, inArray, ne } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db/client.ts';
import { domains, findings, scans, session } from '../db/schema.ts';
import { isDemoAccount } from '../demo/account.ts';
import { TXT_PREFIX } from '../domains/verify.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { CATALOG, type CheckId } from '../scanner/catalog.ts';

/** The signed-in account: its details, where it's signed in, and a copy of all its data. */
export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', async (_req, res) => {
  const user = res.locals.user!;
  const [[websites], [reports]] = await Promise.all([
    db.select({ total: count() }).from(domains).where(eq(domains.userId, user.id)),
    db.select({ total: count() }).from(scans).where(eq(scans.userId, user.id)),
  ]);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      termsAcceptedAt: user.termsAcceptedAt ?? null,
    },
    // What "Delete account" would remove.
    counts: { websites: websites?.total ?? 0, reports: reports?.total ?? 0 },
    // The account set up for presenting Sentry sees "Reset demo" on its Account page, and can't be deleted.
    isDemo: isDemoAccount(user.email),
  });
});

/**
 * "Where you're signed in": each live session's browser and when it started. Session tokens never
 * leave the server; a session is named by its id, and only within this account.
 */
meRouter.get('/sessions', async (_req, res) => {
  const current = res.locals.session!;
  const rows = await db
    .select({ id: session.id, userAgent: session.userAgent, createdAt: session.createdAt })
    .from(session)
    .where(and(eq(session.userId, res.locals.user!.id), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.createdAt));
  const sessions = rows.map((s) => ({ ...s, current: s.id === current.id }));
  res.json({ sessions: [...sessions.filter((s) => s.current), ...sessions.filter((s) => !s.current)] });
});

/** Signs one other device out. This device signs out with "Sign out" instead. */
meRouter.delete('/sessions/:id', async (req, res) => {
  const me = res.locals.user!;
  const current = res.locals.session!;
  if (req.params.id === current.id) {
    res.status(400).json({ error: 'To sign out on this device, use Sign out in the menu.' });
    return;
  }
  const removed = await db
    .delete(session)
    .where(and(eq(session.id, req.params.id), eq(session.userId, me.id), ne(session.id, current.id)))
    .returning({ id: session.id });
  if (removed.length === 0) {
    res.status(404).json({ error: 'That device is already signed out.' });
    return;
  }
  res.status(204).end();
});

/**
 * "Download my data": everything Sentry keeps about this account, in one JSON file (the right of
 * access and to take your data elsewhere, Nigeria Data Protection Act 2023). The password, even
 * scrambled, and session tokens are never included.
 */
meRouter.get(
  '/export',
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `export:${res.locals.user!.id}`,
    message: { error: 'That’s a lot of downloads in a short time. Please wait a minute and try again.' },
  }),
  async (_req, res) => {
    const me = res.locals.user!;
    const [signIns, websites, checks] = await Promise.all([
      db
        .select({
          signedInAt: session.createdAt,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
          browser: session.userAgent,
        })
        .from(session)
        .where(eq(session.userId, me.id))
        .orderBy(asc(session.createdAt)),
      db.select().from(domains).where(eq(domains.userId, me.id)).orderBy(asc(domains.createdAt)),
      db.select().from(scans).where(eq(scans.userId, me.id)).orderBy(asc(scans.createdAt)),
    ]);
    const found = checks.length
      ? await db.select().from(findings).where(inArray(findings.scanId, checks.map((c) => c.id)))
      : [];

    const exportedAt = new Date();
    res
      .set({
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="sentry-my-data-${exportedAt.toISOString().slice(0, 10)}.json"`,
      })
      .send(
        JSON.stringify(
          {
            about: 'Everything Sentry (csentinel.com.ng) keeps about your account. Your password is never included.',
            exportedAt,
            account: {
              name: me.name,
              email: me.email,
              emailConfirmed: me.emailVerified,
              createdAt: me.createdAt,
              scanningAgreementAcceptedAt: me.termsAcceptedAt ?? null,
            },
            signIns,
            websites: websites.map((w) => ({
              hostname: w.hostname,
              addedAt: w.createdAt,
              provenYoursAt: w.verifiedAt,
              ownershipRecord: `${TXT_PREFIX}${w.verifyToken}`,
              automaticChecks: w.rescanInterval,
              nextCheckAt: w.nextCheckAt,
              emailAlerts: w.alertsEnabled,
            })),
            checks: checks.map((c) => ({
              id: c.id,
              hostname: c.hostname,
              checkedAt: c.createdAt,
              kind: c.mode === 'full' ? 'full check' : 'light check',
              trigger: c.trigger === 'scheduled' ? 'automatic' : 'manual',
              grade: c.grade,
              score: c.score,
              finalUrl: c.finalUrl,
              results: found
                .filter((f) => f.scanId === c.id)
                .map((f) => ({
                  check: CATALOG[f.checkId as CheckId]?.title ?? f.checkId,
                  result: f.status === 'pass' ? 'passed' : 'problem found',
                  severity: f.severity,
                  evidence: f.evidence,
                })),
            })),
          },
          null,
          2,
        ),
      );
  },
);
