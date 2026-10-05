import { env } from '../env.ts';

/** True for the one account set up for presenting Sentry (DEMO_EMAIL). */
export function isDemoAccount(email: string): boolean {
  return !!env.DEMO_EMAIL && email.toLowerCase() === env.DEMO_EMAIL.toLowerCase();
}
