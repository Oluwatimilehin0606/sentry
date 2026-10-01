import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { startScheduler } from './schedule/runner.ts';

// Sentry is one program on one address (APP_URL, http://localhost:5173 on this machine): the API
// and the website together. In production (the demo) it serves the built website from
// client/dist; otherwise Vite runs inside it, so website edits show at once.
const client = path.resolve(import.meta.dirname, '../../client');
const website = path.join(client, 'dist');
const production = env.NODE_ENV === 'production';
const port = Number(new URL(env.APP_URL).port) || 80;

if (production && !fs.existsSync(path.join(website, 'index.html'))) {
  console.error('The website hasn’t been built yet. Run `npm run build` first, then start again.');
  process.exit(1);
}

const server = http.createServer();
const app = production ? createApp({ website }) : createApp({ csp: false });
if (!production) {
  // Vite's live-reload messages for the website share the same port.
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: client,
    configFile: path.join(client, 'vite.config.ts'),
    appType: 'spa',
    // Load vite.config.ts without writing a temporary copy: node --watch saw those copies
    // come and go and restarted the server over and over.
    configLoader: 'runner',
    server: { middlewareMode: true, hmr: { server } },
  });
  app.use(vite.middlewares);
}
server.on('request', app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Sentry is already running at ${env.APP_URL} (or something else is using port ${port}).\n` +
        'Close the other one first (development and the demo can’t run at the same time), then start again.',
    );
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  logger.info(`Sentry is running at ${env.APP_URL}`);
  // Automatic checks run inside this process; tests (and the browser test) run without them.
  if (env.NODE_ENV !== 'test') {
    startScheduler();
    logger.info('Automatic checks: looking for due websites every minute');
  }
});
