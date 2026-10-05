import { createAuthClient } from 'better-auth/react';

// Same origin as the web app: Vite proxies /api to the API server in development.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export const { useSession, signIn, signUp, signOut, sendVerificationEmail, requestPasswordReset, resetPassword } = authClient;

/**
 * Where the "confirm your email" link lands. Confirmed: the person is signed in, and sign-in sends
 * them on to Home. Link expired or already used: sign-in explains, with ?error=.
 */
export const CONFIRMED_URL = '/sign-in?confirmed=1';
