import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  // The database check is added in Phase 1, once Postgres is wired up.
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});
