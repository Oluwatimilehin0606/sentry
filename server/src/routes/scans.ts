import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { domains } from '../db/schema.ts';
import { saveDeveloper, sendReportToDeveloper } from '../developer/send.ts';
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

const SendBody = z.object({
  // A new or changed developer; left out to use the website's saved one.
  developer: z.object({ name: z.string().trim().min(1).max(80), email: z.email().max(254) }).optional(),
  note: z.string().trim().max(1000).optional(),
  autoSend: z.boolean().optional(),
  copyToMe: z.boolean().default(false),
});

/**
 * "Send to my developer": emails the report (note, problems, PDF) to whoever built the website,
 * replies going to the owner. A new developer is remembered for the website. At most 10 a day,
 * so nobody can use Sentry to send email to strangers in bulk.
 */
scansRouter.post(
  '/:id/send',
  rateLimit({
    windowMs: 24 * 60 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `send-developer:${res.locals.user!.id}`,
    message: { error: 'You’ve sent 10 reports today. Please try again tomorrow.' },
  }),
  async (req, res) => {
    const me = res.locals.user!;
    const id = String(req.params.id);
    const report = Id.safeParse(id).success ? await getScan(me.id, id) : null;
    if (!report) {
      res.status(404).json({ error: 'We couldn’t find that report in your account.' });
      return;
    }
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter your developer’s name and a valid email address.' });
      return;
    }
    const body = parsed.data;
    const [site] = await db.select().from(domains).where(and(eq(domains.userId, me.id), eq(domains.hostname, report.hostname)));
    let developer = body.developer;
    let stopToken: string | null = null;
    if (site && developer) {
      const saved = await saveDeveloper(site.id, site, { ...developer, autoSend: body.autoSend ?? site.developerAutoSend });
      stopToken = saved.developerStopToken;
    } else if (site?.developerEmail && !developer) {
      developer = { name: site.developerName ?? '', email: site.developerEmail };
      stopToken = site.developerStopToken;
    }
    if (!developer) {
      res.status(400).json({ error: 'Enter your developer’s name and email.' });
      return;
    }
    const sent = await sendReportToDeveloper({
      owner: { name: me.name, email: me.email },
      developer,
      report,
      note: body.note,
      stopToken,
      copyToOwner: body.copyToMe,
    });
    if (!sent) {
      res.status(502).json({ error: 'The email couldn’t be sent just now. Please try again in a minute.' });
      return;
    }
    res.json({ sentTo: { name: developer.name, email: developer.email }, at: new Date().toISOString() });
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
