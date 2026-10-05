import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.ts';
import { isDemoAccount } from './demo.ts';

export const meRouter = Router();

meRouter.get('/', requireAuth, (_req, res) => {
  const user = res.locals.user!;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      termsAcceptedAt: user.termsAcceptedAt ?? null,
    },
    // The account set up for presenting Sentry sees "Reset demo" on its Account page.
    isDemo: isDemoAccount(user.email),
  });
});
