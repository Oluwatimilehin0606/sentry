import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env.ts';
import { pdfFileName, reportPdf } from '../reports/pdf.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { normalizeHostname } from '../scanner/domain.ts';
import { getScan, listScans } from '../scans/store.ts';

/** Saved checks: the Reports list and each report's own page. Only ever the signed-in account's. */
export const scansRouter = Router();
scansRouter.use(requireAuth);

const ListQuery = z.object({
  hostname: z.string().max(300).optional(),
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

scansRouter.get('/', async (req, res) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'That list request wasn’t valid.' });
    return;
  }
  const { hostname, before, limit } = parsed.data;
  const host = hostname ? normalizeHostname(hostname) : undefined;
  if (hostname && !host) {
    res.status(400).json({ error: 'Enter a valid domain, like yourbakery.com.' });
    return;
  }
  res.json(
    await listScans(res.locals.user!.id, {
      hostname: host ?? undefined,
      before: before ? new Date(before) : undefined,
      limit,
    }),
  );
});

const Id = z.uuid();

/** A saved report as a PDF download ("Download PDF" on the report's page). */
scansRouter.get(
  '/:id/pdf',
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `pdf:${res.locals.user!.id}`,
    message: { error: 'That’s a lot of downloads in a short time. Please wait a minute and try again.' },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const report = Id.safeParse(id).success ? await getScan(res.locals.user!.id, id) : null;
    if (!report) {
      res.status(404).json({ error: 'We couldn’t find that report in your account.' });
      return;
    }
    const pdf = await reportPdf(report, { timeZone: env.APP_TIMEZONE });
    res
      .status(200)
      .set({
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${pdfFileName(report, env.APP_TIMEZONE)}"`,
        'cache-control': 'private, no-store',
      })
      .send(pdf);
  },
);

scansRouter.get('/:id', async (req, res) => {
  const report = Id.safeParse(req.params.id).success ? await getScan(res.locals.user!.id, req.params.id) : null;
  if (!report) {
    res.status(404).json({ error: 'We couldn’t find that report in your account.' });
    return;
  }
  res.json({ report });
});
