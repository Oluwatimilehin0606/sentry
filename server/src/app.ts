import path from 'node:path';
import { toNodeHandler } from 'better-auth/node';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { auth, CLIENT_IP_HEADER } from './auth.ts';
import { demoSite } from './demo-site.ts';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { domainsRouter } from './routes/domains.ts';
import { healthRouter } from './routes/health.ts';
import { meRouter } from './routes/me.ts';
import { scanRouter } from './routes/scan.ts';
import { scansRouter } from './routes/scans.ts';

export type AppOptions = {
  /** Folder of the built website (client/dist) to serve next to the API, on the same port. */
  website?: string;
  /**
   * Sentry's Content-Security-Policy (default on). Off only while Vite serves the website during
   * development: its live reload needs inline scripts and a websocket.
   */
  csp?: boolean;
  /** Proxies in front of Sentry (see TRUST_PROXY in env.ts). */
  trustProxy?: number;
  /** Serve the deliberately weak demo website at this hostname (see DEMO_SITE_HOST in env.ts). */
  demoSiteHost?: string;
};

const startedAt = Date.now();

export function createApp({
  website,
  csp = true,
  trustProxy = env.TRUST_PROXY,
  demoSiteHost = env.DEMO_SITE_HOST,
}: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  // The demo website comes first: it must not get Sentry's own protections, or it wouldn't be weak.
  if (demoSiteHost) app.use(demoSite(demoSiteHost));
  // Sentry's own security headers. Everything the website loads (scripts, styles, fonts) comes
  // from Sentry itself, so the policy can be strict: no inline or outside scripts at all.
  // Inline styles are allowed because the dialog and chart components set some at run time.
  const https = env.APP_URL.startsWith('https://');
  app.use(
    helmet({
      contentSecurityPolicy: csp && {
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
      // Only API calls: not the status badge polling /api/health every few seconds, and not the
      // website's own files.
      // Health checks do show for the first 3 minutes after start, when the host checks a new
      // deploy before sending visitors to it.
      autoLogging: {
        ignore: (req) =>
          (req.url === '/api/health' && Date.now() - startedAt > 3 * 60_000) || !req.url?.startsWith('/api'),
      },
    }),
  );

  // Sign-in limits are per client address. Better Auth would otherwise trust an X-Forwarded-For
  // header, which anyone can fake to get a fresh allowance on every try. Express works out the
  // real address instead: the connection's own on this machine, or, behind the host's proxy
  // (trust proxy), the address that proxy saw, which a visitor can't fake.
  app.use((req, _res, next) => {
    req.headers[CLIENT_IP_HEADER] = req.ip ?? '';
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

  if (website) serveWebsite(app, website);

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    // The caller's mistakes (unreadable or oversized body, a website file that doesn't exist)
    // aren't crashes: answer with their own status and a plain message.
    if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
      const message = { 404: 'Not found', 413: 'That request was too large.' }[err.status as number];
      res.status(err.status).json({ error: message ?? 'That request wasn’t valid.' });
      return;
    }
    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  };
  app.use(errorHandler);

  return app;
}

/**
 * The built website. Vite gives every file in assets/ a name that changes with its content, so
 * browsers may keep those for a year; index.html is always re-checked so a new build shows at once.
 * Every other address (/home, /websites/…) gets index.html too, and the website's own router
 * takes it from there.
 */
function serveWebsite(app: express.Express, folder: string) {
  // dotfiles: 'allow' only so it also works from a folder whose path has a dot-folder in it.
  app.use(
    '/assets',
    express.static(path.join(folder, 'assets'), { immutable: true, maxAge: '1y', dotfiles: 'allow', fallthrough: false }),
  );
  app.use(express.static(folder, { index: false, maxAge: '1h', dotfiles: 'allow' }));
  app.get('/{*page}', (_req, res) => {
    res.set('cache-control', 'no-cache');
    res.sendFile(path.join(folder, 'index.html'), { dotfiles: 'allow' });
  });
}
