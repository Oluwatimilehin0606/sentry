import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { db } from './db/client.ts';
import { account, session, user, verification } from './db/schema.ts';
import { isDemoAccount } from './demo/account.ts';
import {
  accountDeletedEmail,
  alreadySignedUpEmail,
  confirmEmail,
  passwordChangedEmail,
  resetPasswordEmail,
} from './email/account.ts';
import { sendEmail } from './email/mailer.ts';
import { env } from './env.ts';
import { isLeakedPassword } from './leaked-password.ts';

/** Set by the app from the connection itself (see app.ts); never taken from the client. */
export const CLIENT_IP_HEADER = 'x-sentry-client-ip';

export const LEAKED_PASSWORD_MESSAGE =
  'This password has turned up in a data breach on another website, so attackers try it first. Please choose a different one.';

/** Where each request carries the password being set (sign-up, or a new one). */
const NEW_PASSWORD_FIELD: Record<string, 'password' | 'newPassword'> = {
  '/sign-up/email': 'password',
  '/reset-password': 'newPassword',
  '/change-password': 'newPassword',
};

const HOUR = 60 * 60;

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
    // No session until the email is confirmed (see emailVerification below).
    requireEmailVerification: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: HOUR,
    // A forgotten password may have been stolen: a reset throws every device out.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited: an answer that took longer for real accounts would give away who has one.
      void sendEmail({ to: user.email, ...resetPasswordEmail(url) });
    },
    // Signing up again with a used email looks the same as a new sign-up (so nobody can find out
    // who has an account); the owner gets this email instead of a second account.
    onExistingUserSignUp: async ({ user }) => {
      void sendEmail({ to: user.email, ...alreadySignedUpEmail(user.name) });
    },
    onPasswordReset: async ({ user }) => {
      void sendEmail({ to: user.email, ...passwordChangedEmail(user.name) });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in before confirming sends a fresh link (the old one may have expired).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * HOUR,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({ to: user.email, ...confirmEmail(user.name, url) });
    },
  },
  user: {
    additionalFields: {
      termsAcceptedAt: { type: 'date', required: false, input: false },
    },
    // "Delete account" on the Account page: everything goes at once (websites, checks and
    // sessions are deleted with the user by the database). Always needs the password (see hooks).
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        if (isDemoAccount(user.email)) {
          throw new APIError('FORBIDDEN', { message: 'The demo account can’t be deleted.' });
        }
      },
      afterDelete: async (user) => {
        void sendEmail({ to: user.email, ...accountDeletedEmail(user.name) });
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },
  advanced: {
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  // Per visitor address (see CLIENT_IP_HEADER), in the server's memory: Sentry runs as one server.
  rateLimit: {
    enabled: env.NODE_ENV !== 'test',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      // Emails: a few an hour, so nobody can flood someone's inbox through Sentry.
      '/send-verification-email': { window: HOUR, max: 5 },
      '/request-password-reset': { window: HOUR, max: 5 },
      '/reset-password': { window: 60, max: 5 },
      '/change-password': { window: 60, max: 5 },
      '/delete-user': { window: 60, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Sign-up must include explicit agreement to only scan domains the user owns.
      if (ctx.path === '/sign-up/email' && ctx.body?.acceptTerms !== true) {
        throw new APIError('BAD_REQUEST', {
          message: 'Please confirm you will only scan websites you own or have permission to test.',
        });
      }
      // Deleting the account always asks for the password, even right after signing in.
      if (ctx.path === '/delete-user' && !(typeof ctx.body?.password === 'string' && ctx.body.password.length > 0)) {
        throw new APIError('BAD_REQUEST', { message: 'Type your password to confirm.', code: 'PASSWORD_REQUIRED' });
      }
      // No password known from a data breach, wherever a password is chosen.
      const field = NEW_PASSWORD_FIELD[ctx.path];
      const password = field ? ctx.body?.[field] : undefined;
      if (typeof password === 'string' && password.length >= 12 && (await isLeakedPassword(password))) {
        throw new APIError('BAD_REQUEST', { message: LEAKED_PASSWORD_MESSAGE, code: 'PASSWORD_LEAKED' });
      }
    }),
    // "Your password was changed" after Account → Change password, so a stranger can't do it
    // quietly. (A reset from the email link sends it from onPasswordReset above.)
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/change-password' || ctx.context.returned instanceof Error) return;
      const changed = ctx.context.session?.user;
      if (changed) void sendEmail({ to: changed.email, ...passwordChangedEmail(changed.name) });
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
