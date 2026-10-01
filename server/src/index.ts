import { createApp } from './app.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { startScheduler } from './schedule/runner.ts';

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info(`Sentry API listening on http://localhost:${env.API_PORT}`);
  // Automatic checks run inside the API process; tests (and the browser test) run without them.
  if (env.NODE_ENV !== 'test') {
    startScheduler();
    logger.info('Automatic checks: looking for due websites every minute');
  }
});
