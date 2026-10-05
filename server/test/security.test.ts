import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { CLIENT_IP_HEADER } from '../src/auth.ts';
import { pool } from '../src/db/client.ts';
import { ORIGIN, resetDatabase, signedInAgent } from './helpers.ts';

afterAll(async () => {
  await pool.end();
});

describe('Sentry’s own security headers', () => {
  it('sends a strict Content-Security-Policy', async () => {
    const res = await request(createApp()).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;

    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Sentry runs on plain http on this machine, so nothing may be forced to https yet.
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('turns off the camera, microphone and location for every page', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('geolocation=()');
  });

  it('tells browsers not to keep a copy of any API answer', async () => {
    const app = createApp();
    expect((await request(app).get('/api/health')).headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/me')).headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/auth/get-session')).headers['cache-control']).toContain('no-store');
  });
});

describe('the visitor address used for sign-in limits', () => {
  /** The address Sentry hands to Better Auth for this request. */
  async function seenAs(trustProxy: number, forwardedFor?: string) {
    const app = createApp({ trustProxy });
    app.get('/seen-as', (req, res) => {
      res.send(req.headers[CLIENT_IP_HEADER]);
    });
    const req = request(app).get('/seen-as');
    return (forwardedFor ? req.set('x-forwarded-for', forwardedFor) : req).then((r) => r.text);
  }

  it('ignores a faked X-Forwarded-For when nothing sits in front of Sentry', async () => {
    expect(await seenAs(0, '203.0.113.9')).toMatch(/127.0.0.1|::1/);
  });

  it('finds the visitor behind Render’s three hops, even if they add a fake address', async () => {
    // As measured on Render: visitor, then Cloudflare, then Render's load balancer (the relay on the
    // machine itself is the connection). The visitor tried to slip "203.0.113.9" in front.
    expect(await seenAs(3, '203.0.113.9, 198.51.100.7, 172.71.0.1, 10.29.0.1')).toBe('198.51.100.7');
  });

  it('takes the address the host’s proxy saw, not one the visitor added in front', async () => {
    // The visitor sent "203.0.113.9"; the proxy appended the real address it saw.
    expect(await seenAs(1, '203.0.113.9, 198.51.100.7')).toBe('198.51.100.7');
  });
});

describe('changes must come from Sentry’s own pages', () => {
  beforeEach(resetDatabase);

  it('refuses a change sent from another website, even with a valid session', async () => {
    const agent = await signedInAgent(createApp());
    const res = await agent.post('/api/domains').set('Origin', 'http://localhost:8081').send({ domain: 'yourbakery.com' });

    expect(res.status).toBe(403);
  });

  it('accepts the same change from Sentry itself', async () => {
    const agent = await signedInAgent(createApp());
    const res = await agent.post('/api/domains').set('Origin', ORIGIN).send({ domain: 'yourbakery.com' });

    expect(res.status).toBe(201);
  });
});

describe('bad request bodies', () => {
  it('answers unreadable JSON with 400, not a server error', async () => {
    const res = await request(createApp())
      .post('/api/domains')
      .set('content-type', 'application/json')
      .send('{"domain": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('That request wasn’t valid.');
  });

  it('answers an oversized body with 413', async () => {
    const res = await request(createApp())
      .post('/api/domains')
      .send({ domain: 'a'.repeat(20_000) });

    expect(res.status).toBe(413);
  });
});

describe('browser-test switches', () => {
  /** Loads e2e.ts in a fresh process with these settings; returns its exit code and error output. */
  function load(env: Record<string, string>) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/e2e.ts')"], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
    });
    return { code: result.status, stderr: result.stderr };
  }
  const SITES = JSON.stringify({ 'bakery.test': { https: 8443, http: 8081, caFile: 'e2e/.tmp/ca.pem' } });

  it('refuse to switch on once Sentry is online', () => {
    const { code, stderr } = load({ NODE_ENV: 'production', APP_URL: 'https://sentry.example', SENTRY_E2E_SITES: SITES });

    expect(code).not.toBe(0);
    expect(stderr).toContain('must not be set once Sentry is online');
  });

  it('switch on for the demo build on this machine', () => {
    expect(load({ NODE_ENV: 'production', APP_URL: 'http://localhost:5173', SENTRY_E2E_SITES: SITES }).code).toBe(0);
  });

  it('only accept made-up .test names', () => {
    const sites = JSON.stringify({ 'yourbakery.com': { https: 8443, http: 8081, caFile: 'e2e/.tmp/ca.pem' } });
    const { code, stderr } = load({ NODE_ENV: 'development', SENTRY_E2E_SITES: sites });

    expect(code).not.toBe(0);
    expect(stderr).toContain('may only list .test names');
  });

  it('load for browser tests', () => {
    expect(load({ NODE_ENV: 'development', SENTRY_E2E_SITES: SITES }).code).toBe(0);
  });
});
