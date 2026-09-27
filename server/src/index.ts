import { createApp } from './app.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info(`Sentry API listening on http://localhost:${env.API_PORT}`);
});
