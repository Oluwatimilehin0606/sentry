import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
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

  it('refuse to switch on in production', () => {
    const { code, stderr } = load({ NODE_ENV: 'production', SENTRY_E2E_SITES: SITES });

    expect(code).not.toBe(0);
    expect(stderr).toContain('must not be set in production');
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
