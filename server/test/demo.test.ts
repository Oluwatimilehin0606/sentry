import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The demo account is recognised by its email (DEMO_EMAIL), read once when the app loads.
process.env.DEMO_EMAIL = 'adunni@demo.example';
const { createApp } = await import('../src/app.ts');
const { db, pool } = await import('../src/db/client.ts');
const { domains, scans, user } = await import('../src/db/schema.ts');
const { resetDatabase, signedInAgent } = await import('./helpers.ts');

const app = createApp();
let demo: Awaited<ReturnType<typeof signedInAgent>>;
let demoId = '';

beforeAll(async () => {
  await resetDatabase();
  demo = await signedInAgent(app, 'adunni@demo.example');
  demoId = (await db.select().from(user).where(eq(user.email, 'adunni@demo.example')))[0]!.id;
});

afterAll(async () => {
  await pool.end();
});

const checksOf = async (hostname: string) =>
  (await db.select().from(scans).where(and(eq(scans.userId, demoId), eq(scans.hostname, hostname)))).length;

describe('Reset demo', () => {
  it('is only for the demo account', async () => {
    const someone = await signedInAgent(app, 'owner@yourbakery.example');
    expect((await someone.get('/api/me')).body.isDemo).toBe(false);
    expect((await someone.post('/api/demo/reset')).status).toBe(404);
    expect((await demo.get('/api/me')).body.isDemo).toBe(true);
  });

  it('puts the demo websites back with their history, leaving the account’s own websites alone', async () => {
    await demo.post('/api/domains').send({ domain: 'mybakery.example' });

    const res = await demo.post('/api/demo/reset');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ demoSite: 'bakery.test', grade: 'A', score: 96 });

    const sites = (await db.select().from(domains).where(eq(domains.userId, demoId))).map((d) => d.hostname).sort();
    expect(sites).toEqual(['adunnicakes.example', 'bakery.test', 'lagoslaundry.example', 'mamaputkitchen.example', 'mybakery.example']);
    expect(await checksOf('bakery.test')).toBe(5);
  });

  it('replaces checks run since the last reset, instead of adding to them, and keeps the proof', async () => {
    // Proven, as the seed leaves it online (there's no real DNS record for bakery.test here).
    await db
      .update(domains)
      .set({ verifiedAt: new Date() })
      .where(and(eq(domains.userId, demoId), eq(domains.hostname, 'bakery.test')));
    const [before] = await db.select().from(domains).where(and(eq(domains.userId, demoId), eq(domains.hostname, 'bakery.test')));
    await db.insert(scans).values({ userId: demoId, hostname: 'bakery.test', mode: 'full', status: 'done', score: 28, grade: 'F' });
    expect(await checksOf('bakery.test')).toBe(6);

    await demo.post('/api/demo/reset');

    expect(await checksOf('bakery.test')).toBe(5);
    const [after] = await db.select().from(domains).where(and(eq(domains.userId, demoId), eq(domains.hostname, 'bakery.test')));
    expect(after!.verifyToken).toBe(before!.verifyToken);
    expect(after!.verifiedAt).not.toBeNull();
  });

  it('keeps the demo website’s saved developer, so the demo shows the report reaching them', async () => {
    await db
      .update(domains)
      .set({ developerName: 'Tunde', developerEmail: 'tunde@webcraft.example', developerAutoSend: true, developerStopToken: 'stop-token-for-tests-456' })
      .where(and(eq(domains.userId, demoId), eq(domains.hostname, 'bakery.test')));

    await demo.post('/api/demo/reset');

    const [after] = await db.select().from(domains).where(and(eq(domains.userId, demoId), eq(domains.hostname, 'bakery.test')));
    expect(after).toMatchObject({
      developerName: 'Tunde',
      developerEmail: 'tunde@webcraft.example',
      developerAutoSend: true,
      developerStopToken: 'stop-token-for-tests-456',
    });
  });
});
