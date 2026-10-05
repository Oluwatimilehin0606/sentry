import { isPasswordCompromised } from 'better-auth/plugins';
import { env } from './env.ts';
import { logger } from './logger.ts';

/**
 * Whether a password appears in the public Have I Been Pwned list of passwords from data breaches.
 * Only the first 5 characters of the password's SHA-1 hash leave Sentry, never the password.
 * If the list can't be reached, the password is allowed: an outage there mustn't stop sign-ups.
 * Tests never call the internet (they replace this function where they need it).
 */
export async function isLeakedPassword(password: string): Promise<boolean> {
  if (env.NODE_ENV === 'test') return false;
  try {
    return await isPasswordCompromised(password);
  } catch {
    logger.warn('Leaked-password list could not be reached; password allowed');
    return false;
  }
}
