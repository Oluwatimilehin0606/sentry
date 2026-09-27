import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

describe('GET /api/health', () => {
  it('reports the API is up', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('sends security headers', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(createApp()).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
