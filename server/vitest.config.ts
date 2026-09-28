import path from 'node:path';
import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'));
} catch {
  // No .env file: rely on variables already set in the environment.
}

/** Tests always run against the test database, never the dev one. */
function testDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  const name = url.pathname.slice(1) || 'sentry_dev';
  url.pathname = `/${name.endsWith('_dev') ? name.replace(/_dev$/, '_test') : `${name}_test`}`;
  return url.href;
}

const databaseUrl = testDatabaseUrl();

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    },
  },
});
