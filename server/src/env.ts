import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Not `PORT`: dev tools often set PORT for the web app, which would clash.
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment settings. Check your .env file:\n${problems}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
