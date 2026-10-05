type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

/** Turns Better Auth errors into plain-English messages that say how to fix the problem. */
export function authErrorMessage(error: AuthError): string {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';

  switch (error.code) {
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'An account with this email already exists. Sign in instead.';
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'That email and password don’t match. Check them and try again.';
    case 'PASSWORD_TOO_SHORT':
      return 'Use at least 12 characters for your password.';
    case 'PASSWORD_TOO_LONG':
      return 'Use 128 characters or fewer for your password.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Please confirm your email first. We’ve sent you a new link.';
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'That link has expired or was already used.';
    case 'INVALID_EMAIL':
      return 'Enter a valid email address, like you@yourbakery.com.';
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}

/** Only allow redirects back into this app (never to another site). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
}
