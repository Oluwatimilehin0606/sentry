import type { RequestHandler } from 'express';

/**
 * The deliberately weak website for the online demo, served by Sentry's own server when it's
 * visited as DEMO_SITE_HOST (e.g. demo.yourdomain.com.ng). Like the pretend website on this
 * machine (bakery.test): no protection headers, and a public settings file holding made-up values,
 * so a full check finds real problems live. Being part of Sentry's server means it's awake whenever
 * Sentry is (free hosting sleeps when idle).
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mama Adunni's Bakery</title>
</head>
<body style="font-family: Georgia, serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; color: #3b2a1a; background: #fdf8f1">
<h1>Mama Adunni's Bakery</h1>
<p>Fresh bread, meat pies and birthday cakes, baked every morning in Yaba, Lagos.</p>
<p>Open Monday to Saturday, 7am to 7pm. Orders for cakes need two days' notice.</p>
<p style="font-size: 0.875rem; color: #7a6650">This is a pretend business: a demo website for Sentry, built to have security problems on purpose.</p>
</body>
</html>`;

// Made-up values that look like a real settings file, so the check has something to find.
const SETTINGS = `APP_NAME="Mama Adunni's Bakery"
APP_KEY=base64:not-a-real-key-this-is-a-demo
DB_HOST=127.0.0.1
DB_PASSWORD=not-a-real-password
PAYSTACK_SECRET_KEY=sk_test_not_a_real_key
`;

export function demoSite(hostname: string): RequestHandler {
  const host = hostname.toLowerCase();
  return (req, res, next) => {
    if (req.hostname?.toLowerCase() !== host) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).type('text/plain').send('Method not allowed');
      return;
    }
    if (req.path === '/') {
      res.type('html').send(PAGE);
    } else if (req.path === '/.env') {
      res.type('text/plain').send(SETTINGS);
    } else {
      res.status(404).type('html').send('<!doctype html><title>Not found</title><p>Page not found.</p>');
    }
  };
}
