import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Where Sentry runs: the website and API together, on this address's port.
  APP_URL: z.string().url().default('http://localhost:5173'),
  // Online, the host says which port to listen on (its proxy serves APP_URL). Production only:
  // development tools often set PORT for something else.
  PORT: z.coerce.number().int().positive().optional(),
  // How many proxies stand between visitors and Sentry (1 on Render). Their X-Forwarded-For
  // header then gives each visitor's real address, for the sign-in limits. 0 on this machine.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // The deliberately weak demo website served by Sentry's own server (online demo only),
  // e.g. demo.yourdomain.com.ng. Unset: no demo website.
  DEMO_SITE_HOST: z
    .string()
    .regex(/^[a-z0-9.-]+$/i, 'must be a hostname like demo.yourdomain.com.ng')
    .optional()
    .or(z.literal('').transform(() => undefined)),
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
