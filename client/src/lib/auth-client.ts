import { createAuthClient } from 'better-auth/react';

// Same origin as the web app: Vite proxies /api to the API server in development.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export const { useSession, signIn, signUp, signOut } = authClient;
