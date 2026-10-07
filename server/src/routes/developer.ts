import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { domains, user } from '../db/schema.ts';
import { clearDeveloper } from '../developer/send.ts';

/**
 * The developer's "Don't send me reports" link (no account needed): the link opens a page that
 * asks first (GET only describes; POST stops), so email scanners that follow links can't stop
 * reports by accident.
 */
export const developerRouter = Router();
developerRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests in a short time. Please wait a minute and try again.' },
  }),
);

const Token = z.string().min(16).max(64);

async function findByToken(token: unknown) {
  const parsed = Token.safeParse(token);
  if (!parsed.success) return undefined;
  const [row] = await db
    .select({ id: domains.id, hostname: domains.hostname, ownerName: user.name })
    .from(domains)
    .innerJoin(user, eq(user.id, domains.userId))
    .where(eq(domains.developerStopToken, parsed.data));
  return row;
}

const GONE = { error: 'This link has already been used, or the owner has changed who gets the reports.' };

developerRouter.get('/stop', async (req, res) => {
  const row = await findByToken(req.query.token);
  if (!row) {
    res.status(404).json(GONE);
    return;
  }
  res.json({ hostname: row.hostname, ownerName: row.ownerName.trim().split(/\s+/)[0] });
});

developerRouter.post('/stop', async (req, res) => {
  const row = await findByToken(req.body?.token);
  if (!row) {
    res.status(404).json(GONE);
    return;
  }
  await clearDeveloper(row.id);
  res.json({ hostname: row.hostname });
});
