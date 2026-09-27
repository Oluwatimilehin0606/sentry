import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { normalizeHostname } from '../scanner/domain.ts';
import { scanHost } from '../scanner/scan.ts';
import { ScanTargetError } from '../scanner/target.ts';

export const scanRouter = Router();

scanRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many scans in a short time. Please wait a minute and try again.' },
  }),
);

const Body = z.object({ domain: z.string().max(300) });

const STATUS_FOR = { NOT_FOUND: 422, BLOCKED: 400, UNREACHABLE: 422 } as const;

scanRouter.post('/', async (req, res, next) => {
  const parsed = Body.safeParse(req.body);
  const hostname = parsed.success ? normalizeHostname(parsed.data.domain) : null;
  if (!hostname) {
    res.status(400).json({ error: 'Enter a valid domain, like yourbakery.com.' });
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
