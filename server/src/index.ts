import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { startScheduler } from './schedule/runner.ts';

// In production the API also serves the built website, so everything runs on one port.
// (In development Vite serves the website and passes /api on to here.)
const website = path.resolve(import.meta.dirname, '../../client/dist');
if (env.NODE_ENV === 'production' && !fs.existsSync(path.join(website, 'index.html'))) {
  console.error('The website hasn’t been built yet. Run `npm run build` first, then start again.');
  process.exit(1);
}

const app = createApp({ website: env.NODE_ENV === 'production' ? website : undefined });

app.listen(env.API_PORT, () => {
  logger.info(
    env.NODE_ENV === 'production'
      ? `Sentry is running at ${env.APP_URL}`
      : `Sentry API listening on http://localhost:${env.API_PORT}`,
  );
  // Automatic checks run inside the API process; tests (and the browser test) run without them.
  if (env.NODE_ENV !== 'test') {
    startScheduler();
    logger.info('Automatic checks: looking for due websites every minute');
  }
});
