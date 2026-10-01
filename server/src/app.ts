import { toNodeHandler } from 'better-auth/node';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { auth, CLIENT_IP_HEADER } from './auth.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { domainsRouter } from './routes/domains.ts';
import { healthRouter } from './routes/health.ts';
import { meRouter } from './routes/me.ts';
import { scanRouter } from './routes/scan.ts';
import { scansRouter } from './routes/scans.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Sentry's own security headers. Everything the website loads (scripts, styles, fonts) comes
  // from Sentry itself, so the policy can be strict: no inline or outside scripts at all.
  // Inline styles are allowed because the dialog and chart components set some at run time.
  const https = env.APP_URL.startsWith('https://');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          // The build inlines small font subsets into the CSS as data: URLs.
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Only once Sentry itself is on https (it isn't on this machine).
          upgradeInsecureRequests: https ? [] : null,
        },
      },
      strictTransportSecurity: https,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      // One short line per request: never headers, so cookies and session tokens stay out of logs.
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      // originalUrl: inside a router Express shortens req.url (e.g. /api/me becomes /).
      customSuccessMessage: (req, res, ms) =>
        `${req.method} ${(req as express.Request).originalUrl} → ${res.statusCode} (${Math.round(ms)} ms)`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${(req as express.Request).originalUrl} → ${res.statusCode} failed: ${err.message}`,
      // The status badge polls /api/health every few seconds; don't fill the log with it.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  // Sign-in limits are per client address. Better Auth would otherwise trust an X-Forwarded-For
  // header, which anyone can fake to get a fresh allowance on every try. Nothing sits in front of
  // Sentry yet, so the connection's own address is the truth (going online behind a proxy: use
  // Better Auth's trustedProxies instead).
  app.use((req, _res, next) => {
    req.headers[CLIENT_IP_HEADER] = req.socket.remoteAddress ?? '';
    next();
  });

  // Better Auth reads the raw request body itself, so it must come before express.json().
  // It also checks the Origin of its own POSTs against trustedOrigins.
  app.all('/api/auth/{*any}', toNodeHandler(auth));

  // Our own changes (scan, add/remove websites, settings) must come from Sentry's pages too. The
  // session cookie is SameSite=Lax, but another site on this machine (another port of localhost)
  // counts as the "same site", so check the Origin browsers send with every such request.
  const appOrigin = new URL(env.APP_URL).origin;
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (req.method === 'GET' || req.method === 'HEAD' || !origin || origin === appOrigin) return next();
    res.status(403).json({ error: 'This request didn’t come from Sentry.' });
  });

  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/me', meRouter);
  app.use('/api/domains', domainsRouter);
  app.use('/api/scan', scanRouter);
  app.use('/api/scans', scansRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    // Unreadable or oversized request bodies are the caller's mistake, not a crash.
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'That request wasn’t valid.' });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'That request was too large.' });
      return;
    }
    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  };
  app.use(errorHandler);

  return app;
}
