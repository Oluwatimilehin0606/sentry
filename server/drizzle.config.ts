import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('../.env');
} catch {
  // No .env file: rely on variables already set in the environment.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
