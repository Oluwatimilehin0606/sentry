import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { pool } from '../src/db/client.ts';

/** A stand-in for client/dist: index.html plus one built file. */
let website: string;

beforeAll(() => {
  website = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-website-'));
  fs.writeFileSync(path.join(website, 'index.html'), '<!doctype html><title>Sentry</title>');
  fs.mkdirSync(path.join(website, 'assets'));
  fs.writeFileSync(path.join(website, 'assets', 'index-abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(website, 'sw.js'), '// service worker');
  fs.writeFileSync(path.join(website, 'manifest.webmanifest'), '{"name":"Sentry"}');
});

afterAll(async () => {
  fs.rmSync(website, { recursive: true, force: true });
  await pool.end();
});

describe('one port: the API also serves the built website', () => {
  it('serves the website’s pages, always re-checked so a new build shows at once', async () => {
    const res = await request(createApp({ website })).get('/websites/yourbakery.com');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Sentry</title>');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('lets browsers keep built files, whose names change with every build', async () => {
    const res = await request(createApp({ website })).get('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('always re-checks the installed app’s service worker and manifest, so updates reach it', async () => {
    const app = createApp({ website });
    const worker = await request(app).get('/sw.js');
    const manifest = await request(app).get('/manifest.webmanifest');

    expect(worker.headers['cache-control']).toBe('no-cache');
    expect(worker.headers['content-type']).toMatch(/javascript/);
    expect(manifest.headers['cache-control']).toBe('no-cache');
    expect(manifest.headers['content-type']).toMatch(/manifest\+json/);
  });

  it('answers a missing built file with 404, not the page', async () => {
    const res = await request(createApp({ website })).get('/assets/gone.js');

    expect(res.status).toBe(404);
  });

  it('keeps API answers as JSON', async () => {
    const res = await request(createApp({ website })).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('the online demo website (DEMO_SITE_HOST)', () => {
  const demo = () => createApp({ website, demoSiteHost: 'demo.yourbakery.example' });

  it('answers as the deliberately weak website, without Sentry’s protections', async () => {
    const res = await request(demo()).get('/').set('host', 'demo.yourbakery.example');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Mama Adunni');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBeUndefined();
  });

  it('has a public settings file, with made-up values only', async () => {
    const res = await request(demo()).get('/.env').set('host', 'demo.yourbakery.example');

    expect(res.status).toBe(200);
    expect(res.text).toContain('DB_PASSWORD=not-a-real-password');
  });

  it('leaves Sentry itself as it was on every other address', async () => {
    const res = await request(demo()).get('/.env').set('host', 'sentry.yourbakery.example');

    expect(res.text).not.toContain('DB_PASSWORD');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });
});

describe('one public address online (APP_URL)', () => {
  const online = () =>
    createApp({ website, demoSiteHost: 'demo.yourbakery.example', canonicalUrl: 'https://sentry.yourbakery.example' });

  it('forwards the main domain to Sentry’s address, keeping the page', async () => {
    const res = await request(online()).get('/websites/x?alerts=off').set('host', 'yourbakery.example');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://sentry.yourbakery.example/websites/x?alerts=off');
  });

  it('serves Sentry on its own address, and the demo website on its own', async () => {
    expect((await request(online()).get('/api/health').set('host', 'sentry.yourbakery.example')).status).toBe(200);
    expect((await request(online()).get('/').set('host', 'demo.yourbakery.example')).text).toContain('Mama Adunni');
  });
});
