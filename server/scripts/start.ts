// `npm start`: runs Sentry on this machine the production way. The API serves the built website
// on one port (http://localhost:3000), using its own database, sentry_demo, so demo accounts
// never mix with development data. The database is created and brought up to date on the way.
//
// Settings come from .env, then the demo defaults, then .env.demo (optional, never committed)
// for anything the demo should do differently, e.g. send real alert emails.
//
//   --pretend-site  also allow checks of bakery.test (run `npm run demo:site` alongside)
//   --open          open the browser once Sentry is ready
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ensureDatabases, explainDatabaseError, migrateDatabase } from './lib/database.ts';
import { ROOT, useDemoSettings } from './lib/demo-env.ts';

const { values: flags } = parseArgs({
  options: { 'pretend-site': { type: 'boolean' }, open: { type: 'boolean' } },
});

useDemoSettings({ pretendSite: flags['pretend-site'] });
const databaseUrl = process.env.DATABASE_URL!;

try {
  await ensureDatabases(databaseUrl, [new URL(databaseUrl).pathname.slice(1)]);
  await migrateDatabase(databaseUrl);
  console.log('✓ database is up to date');
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

await import(pathToFileURL(path.join(ROOT, 'server/src/index.ts')).href);

if (flags.open) void openWhenReady(process.env.APP_URL!);

/** Waits until Sentry answers, then opens it in the default browser. */
async function openWhenReady(url: string) {
  for (let tries = 0; tries < 60; tries++) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}
