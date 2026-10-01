import dns from 'node:dns';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { domains, user } from '../src/db/schema.ts';
import { covers } from '../src/domains/verify.ts';
import { modeFor } from '../src/routes/scan.ts';
import { resetDatabase, signedInAgent } from './helpers.ts';

const app = createApp();
let owner: Awaited<ReturnType<typeof signedInAgent>>;
let stranger: Awaited<ReturnType<typeof signedInAgent>>;

beforeAll(async () => {
  await resetDatabase();
  owner = await signedInAgent(app, 'owner@yourbakery.example');
  stranger = await signedInAgent(app, 'stranger@elsewhere.example');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

/** Pretend the domain's public DNS holds these TXT records (each record may come in chunks). */
function dnsReturns(records: string[][]) {
  vi.spyOn(dns.promises, 'resolveTxt').mockResolvedValue(records);
}
function dnsFails(code: string) {
  vi.spyOn(dns.promises, 'resolveTxt').mockRejectedValue(Object.assign(new Error(code), { code }));
}

async function addSite(agent: typeof owner, domain: string) {
  const res = await agent.post('/api/domains').send({ domain });
  return res.body.domain as { id: string; hostname: string; verifiedAt: string | null; record: { type: string; value: string } };
}

describe('websites', () => {
  it('requires signing in', async () => {
    const res = await request(app).get('/api/domains');
    expect(res.status).toBe(401);
  });

  it('adds a website with its own verification line, and adding it again returns the same one', async () => {
    const first = await owner.post('/api/domains').send({ domain: '  Shop.YourBakery.example ' });
    expect(first.status).toBe(201);
    expect(first.body.domain).toMatchObject({
      hostname: 'shop.yourbakery.example',
      verifiedAt: null,
      record: { type: 'TXT', value: expect.stringMatching(/^sentry-verify=[0-9a-f]{16}$/) },
    });
    const again = await owner.post('/api/domains').send({ domain: 'shop.yourbakery.example' });
    expect(again.status).toBe(200);
    expect(again.body.domain.id).toBe(first.body.domain.id);
  });

  it('rejects things that are not domains', async () => {
    const res = await owner.post('/api/domains').send({ domain: 'https://yourbakery.example/menu' });
    expect(res.status).toBe(400);
  });

  it('gives each account its own line for the same website', async () => {
    const mine = await addSite(owner, 'yourbakery.example');
    const theirs = await addSite(stranger, 'yourbakery.example');
    expect(theirs.id).not.toBe(mine.id);
    expect(theirs.record.value).not.toBe(mine.record.value);
  });

  it('lists only your own websites', async () => {
    const res = await stranger.get('/api/domains');
    expect(res.body.domains.map((d: { hostname: string }) => d.hostname)).toEqual(['yourbakery.example']);
  });

  it('treats someone else’s website as not found', async () => {
    const mine = await addSite(owner, 'private.yourbakery.example');
    expect((await stranger.post(`/api/domains/${mine.id}/verify`)).status).toBe(404);
    expect((await stranger.delete(`/api/domains/${mine.id}`)).status).toBe(404);
    expect((await stranger.delete('/api/domains/not-a-uuid')).status).toBe(404);
  });
});

describe('verifying ownership', () => {
  it('says "not found yet" when the line is missing or different', async () => {
    const site = await addSite(owner, 'yourbakery.example');
    dnsReturns([['v=spf1 include:_spf.example ~all'], ['sentry-verify=0000000000000000']]);
    const res = await owner.post(`/api/domains/${site.id}/verify`);
    expect(res.body).toMatchObject({ verified: false, reason: 'not_found' });

    dnsFails('ENODATA');
    expect((await owner.post(`/api/domains/${site.id}/verify`)).body).toMatchObject({ verified: false, reason: 'not_found' });
  });

  it('refuses another account’s line', async () => {
    const mine = await addSite(owner, 'yourbakery.example');
    const theirs = await addSite(stranger, 'yourbakery.example');
    dnsReturns([[theirs.record.value]]);
    expect((await owner.post(`/api/domains/${mine.id}/verify`)).body.verified).toBe(false);
  });

  it('verifies when the line is there, even split into chunks or quoted', async () => {
    const site = await addSite(owner, 'yourbakery.example');
    const [head, tail] = [site.record.value.slice(0, 10), site.record.value.slice(10)];
    dnsReturns([['google-site-verification=abc'], [`"${head}`, `${tail}"`]]);
    const res = await owner.post(`/api/domains/${site.id}/verify`);
    expect(res.body).toMatchObject({ verified: true, domain: { verifiedAt: expect.any(String) } });

    // Once verified it stays verified, without asking DNS again.
    vi.restoreAllMocks();
    const spy = vi.spyOn(dns.promises, 'resolveTxt');
    expect((await owner.post(`/api/domains/${site.id}/verify`)).body.verified).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('removes a website', async () => {
    const site = await addSite(owner, 'old.yourbakery.example');
    expect((await owner.delete(`/api/domains/${site.id}`)).status).toBe(204);
    const list = await owner.get('/api/domains');
    expect(list.body.domains.some((d: { id: string }) => d.id === site.id)).toBe(false);
  });
});

describe('light or full check', () => {
  it('covers a verified domain and its subdomains, never the other way round', () => {
    expect(covers('yourbakery.example', 'yourbakery.example')).toBe(true);
    expect(covers('yourbakery.example', 'shop.yourbakery.example')).toBe(true);
    expect(covers('shop.yourbakery.example', 'yourbakery.example')).toBe(false);
    expect(covers('yourbakery.example', 'notyourbakery.example')).toBe(false);
  });

  it('gives the full check only to the account that verified', async () => {
    const [ownerRow] = await db.select().from(user).where(eq(user.email, 'owner@yourbakery.example'));
    const [strangerRow] = await db.select().from(user).where(eq(user.email, 'stranger@elsewhere.example'));
    // The owner verified yourbakery.example above; the stranger added it but never verified.
    const verified = await db.select().from(domains).where(eq(domains.userId, ownerRow!.id));
    expect(verified.some((d) => d.hostname === 'yourbakery.example' && d.verifiedAt)).toBe(true);

    expect(await modeFor(ownerRow!.id, 'yourbakery.example')).toBe('full');
    expect(await modeFor(ownerRow!.id, 'shop.yourbakery.example')).toBe('full');
    expect(await modeFor(ownerRow!.id, 'example.com')).toBe('light');
    expect(await modeFor(strangerRow!.id, 'yourbakery.example')).toBe('light');
  });
});
