import { Router } from 'express';
import { isDatabaseUp } from '../db/client.ts';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbUp = await isDatabaseUp();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'ok' : 'unreachable',
    uptime: Math.round(process.uptime()),
  });
});
