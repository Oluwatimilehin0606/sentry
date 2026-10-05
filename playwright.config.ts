import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Browser test of the whole journey, on its own port and the *test* database: a pretend website
 * (e2e/fixture-site.ts) and Sentry itself (website and API together) in end-to-end mode.
 * Run with `npm run test:e2e`. It uses the Chrome installed on this machine.
 */
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '.env'));
} catch {
  // No .env file: rely on variables already set in the environment.
}

/** Same rule as the unit tests: <name>_dev becomes <name>_test. Never the dev database. */
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  const url = new URL(process.env.DATABASE_URL);
  const name = url.pathname.slice(1) || 'sentry_dev';
  url.pathname = `/${name.endsWith('_dev') ? name.replace(/_dev$/, '_test') : `${name}_test`}`;
  return url.href;
}

const TMP = path.resolve(import.meta.dirname, 'e2e/.tmp');
// Not 5173, so it can run while Sentry itself is running.
const APP_URL = 'http://localhost:5174';
process.env.E2E_DATABASE_URL = testDatabaseUrl();
/** Servers get this machine's environment (PATH, secrets from .env) plus their own settings. */
const inherited = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: APP_URL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fixture-site.ts',
      url: 'http://127.0.0.1:8081/',
      // `npm run demo:site` serves the same pretend website (and writes its certificate), so reuse it.
      reuseExistingServer: true,
    },
    {
      command: 'node server/src/index.ts',
      url: `${APP_URL}/api/health`,
      reuseExistingServer: false,
      env: {
        ...inherited,
        NODE_ENV: 'test',
        APP_URL,
        DATABASE_URL: process.env.E2E_DATABASE_URL,
        SENTRY_E2E_SITES: JSON.stringify({ 'bakery.test': { https: 8443, http: 8081, caFile: path.join(TMP, 'ca.pem') } }),
        SENTRY_E2E_TXT_FILE: path.join(TMP, 'txt.json'),
        // Emails (e.g. "confirm your email") are written here instead of sent.
        TEST_OUTBOX_FILE: path.join(TMP, 'outbox.jsonl'),
      },
    },
  ],
});
