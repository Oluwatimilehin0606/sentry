import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.ts';
import { healthRouter } from './routes/health.ts';
import { scanRouter } from './routes/scan.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/scan', scanRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  };
  app.use(errorHandler);

  return app;
}
