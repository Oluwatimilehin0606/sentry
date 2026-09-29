import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.ts';
import { normalizeHostname } from '../scanner/domain.ts';
import { scanHost, type ScanProgress } from '../scanner/scan.ts';
import { ScanTargetError } from '../scanner/target.ts';

export const scanRouter = Router();

// Scanning is a signed-in feature: visitors can read about Sentry, but only account holders scan.
scanRouter.use(requireAuth);
scanRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Limit per account, not per IP, now that every scan has a signed-in user.
    keyGenerator: (_req, res) => `user:${res.locals.user!.id}`,
    message: { error: 'Too many scans in a short time. Please wait a minute and try again.' },
  }),
);

const Body = z.object({ domain: z.string().max(300) });

const STATUS_FOR = { NOT_FOUND: 422, BLOCKED: 400, UNREACHABLE: 422, TIMEOUT: 504 } as const;

scanRouter.post('/', async (req, res, next) => {
  const parsed = Body.safeParse(req.body);
  const hostname = parsed.success ? normalizeHostname(parsed.data.domain) : null;
  if (!hostname) {
    res.status(400).json({ error: 'Enter a valid domain, like yourbakery.com.' });
    return;
  }

  // The home page asks for live progress: one JSON object per line as each part of the scan
  // finishes, then the report (or an error). Other callers get the plain JSON report.
  if (req.accepts(['application/json', 'application/x-ndjson']) === 'application/x-ndjson') {
    res.status(200).set({
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders();
    const send = (line: object) => {
      if (!res.writableEnded && !res.destroyed) res.write(`${JSON.stringify(line)}\n`);
    };
    try {
      const report = await scanHost(hostname, undefined, (progress: ScanProgress) => send({ type: 'progress', ...progress }));
      send({ type: 'report', report });
    } catch (err) {
      if (err instanceof ScanTargetError) {
        send({ type: 'error', error: err.message, code: err.code });
      } else {
        req.log.error({ err }, 'Scan failed');
        send({ type: 'error', error: 'Something went wrong on our side. Please try again.' });
      }
    }
    res.end();
    return;
  }

  try {
    res.json(await scanHost(hostname));
  } catch (err) {
    if (err instanceof ScanTargetError) {
      res.status(STATUS_FOR[err.code]).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});
