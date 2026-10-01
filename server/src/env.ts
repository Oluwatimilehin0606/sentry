import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Where Sentry runs: the website and API together, on this address's port.
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string({ error: 'is not set. Copy .env.example to .env and fill it in.' })
    .regex(/^postgres(ql)?:\/\//, 'must start with postgres://'),
  // Where alert emails go. In development: the local test inbox (`npm run mail`, MailDev).
  SMTP_URL: z.string().regex(/^smtps?:\/\//, 'must start with smtp:// or smtps://').default('smtp://localhost:1025'),
  MAIL_FROM: z.string().default('Sentry <alerts@sentry.local>'),
  // Time zone for times written in emails (most users are in Nigeria).
  APP_TIMEZONE: z.string().default('Africa/Lagos'),
  BETTER_AUTH_SECRET: z
    .string({ error: 'is not set. Copy .env.example to .env and fill it in.' })
    .min(32, 'must be at least 32 characters'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')} ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment settings. Check your .env file:\n${problems}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
