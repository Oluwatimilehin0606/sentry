import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import { auth, type Session } from '../auth.ts';

declare module 'express-serve-static-core' {
  interface Locals {
    session?: Session['session'];
    user?: Session['user'];
  }
}

/** Rejects requests without a valid session; otherwise puts the user on res.locals. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) {
      res.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    res.locals.session = result.session;
    res.locals.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
}
