import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { db } from './db/client.ts';
import { account, session, user, verification } from './db/schema.ts';
import { env } from './env.ts';

/** Set by the app from the connection itself (see app.ts); never taken from the client. */
export const CLIENT_IP_HEADER = 'x-sentry-client-ip';

export const auth = betterAuth({
  appName: 'Sentry',
  // Browsers reach the API through the web app's origin (Vite proxies /api in dev).
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      termsAcceptedAt: { type: 'date', required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },
  advanced: {
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  rateLimit: {
    enabled: env.NODE_ENV !== 'test',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
  hooks: {
    // Sign-up must include explicit agreement to only scan domains the user owns.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      if (ctx.body?.acceptTerms !== true) {
        throw new APIError('BAD_REQUEST', {
          message: 'Please confirm you will only scan websites you own or have permission to test.',
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({ data: { ...newUser, termsAcceptedAt: new Date() } }),
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
