import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db/client.ts';
import { domains } from '../db/schema.ts';
import { mainDomain, plantDemoWebsites } from '../demo/websites.ts';
import { hasVerifyRecord, newVerifyToken } from '../domains/verify.ts';
import { env } from '../env.ts';
import { requireAuth } from '../middleware/require-auth.ts';

/** True for the one account set up for presenting Sentry (DEMO_EMAIL). */
export function isDemoAccount(email: string): boolean {
  return !!env.DEMO_EMAIL && email.toLowerCase() === env.DEMO_EMAIL.toLowerCase();
}

/** "Reset demo" on the demo account's Account page. Every other account gets a plain 404. */
export const demoRouter = Router();
demoRouter.use(requireAuth);

demoRouter.post(
  '/reset',
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `demo-reset:${res.locals.user!.id}`,
    message: { error: 'That’s a lot of resets in a short time. Please wait a minute and try again.' },
  }),
  async (_req, res) => {
    const me = res.locals.user!;
    if (!isDemoAccount(me.email)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const demoSite = env.DEMO_SITE_HOST || 'bakery.test';

    // Keep the demo website's proof as it is, so the DNS record never has to change.
    const [existing] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.userId, me.id), eq(domains.hostname, demoSite)));
    let demoToken = existing?.verifyToken ?? env.DEMO_VERIFY_TOKEN ?? newVerifyToken();
    let demoVerified = !!existing?.verifiedAt;
    if (!existing) {
      demoToken = env.DEMO_VERIFY_TOKEN ?? demoToken;
      demoVerified = (await hasVerifyRecord(mainDomain(demoSite), demoToken)).found;
    }

    const planted = await plantDemoWebsites(me.id, { demoSite, demoToken, demoVerified });
    const latest = planted.find((s) => s.hostname === demoSite)?.grades.at(-1);
    res.json({ demoSite, grade: latest?.grade ?? null, score: latest?.score ?? null, verified: demoVerified });
  },
);
