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
