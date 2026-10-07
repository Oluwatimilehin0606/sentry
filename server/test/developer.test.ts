import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { domains, scans, user } from '../src/db/schema.ts';
import { testOutbox } from '../src/email/mailer.ts';
import { buildReport } from '../src/scanner/scan.ts';
import { saveScan } from '../src/scans/store.ts';
import { ORIGIN, resetDatabase, signedInAgent } from './helpers.ts';

const app = createApp();
type Agent = Awaited<ReturnType<typeof signedInAgent>>;

/** A saved F report for yourbakery.example, with the website added to the account. */
async function setUp(): Promise<{ owner: Agent; reportId: string; siteId: string }> {
  const owner = await signedInAgent(app, 'ada@yourbakery.example');
  await db.update(user).set({ name: 'Adunni Bakare' }).where(eq(user.email, 'ada@yourbakery.example'));
  const siteId = (await owner.post('/api/domains').send({ domain: 'yourbakery.example' })).body.domain.id;
  const [me] = await db.select().from(user).where(eq(user.email, 'ada@yourbakery.example'));
  const report = buildReport({
    hostname: 'yourbakery.example',
    mode: 'full',
    scannedAt: new Date().toISOString(),
    durationMs: 1000,
    findings: [
      { checkId: 'path.env_exposed', status: 'fail', evidence: 'GET https://yourbakery.example/.env → 200' },
      { checkId: 'header.hsts_missing', status: 'fail' },
      { checkId: 'tls.no_https', status: 'pass' },
    ],
  });
  const reportId = await saveScan(me!.id, report);
  testOutbox.length = 0; // (the sign-up's confirm email)
  return { owner, reportId, siteId };
}

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('Send to my developer', () => {
  it('emails the developer the note, the problems and the PDF, with replies going to the owner', async () => {
    const { owner, reportId, siteId } = await setUp();
    const res = await owner.post(`/api/scans/${reportId}/send`).send({
      developer: { name: 'Tunde', email: 'tunde@webcraft.example' },
      note: 'Hi Tunde, please fix these.',
      autoSend: true,
      copyToMe: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.sentTo).toEqual({ name: 'Tunde', email: 'tunde@webcraft.example' });
    const [toDeveloper, copy] = testOutbox;
    expect(toDeveloper).toMatchObject({ to: 'tunde@webcraft.example', replyTo: 'ada@yourbakery.example' });
    expect(toDeveloper!.subject).toBe('Adunni asked you to fix 2 security problems on yourbakery.example');
    expect(toDeveloper!.text).toContain('Hi Tunde, please fix these.');
    expect(toDeveloper!.text).toContain('Your private settings file is public');
    expect(toDeveloper!.text).toMatch(/\/stop-reports\?token=/);
    expect(toDeveloper!.attachments![0]!.content.subarray(0, 4).toString()).toBe('%PDF');
    expect(copy).toMatchObject({ to: 'ada@yourbakery.example' });
    expect(copy!.subject).toMatch(/^Copy: /);

    // Remembered for the website, and recorded on the report.
    const site = (await owner.get('/api/domains')).body.domains.find((d: { id: string }) => d.id === siteId);
    expect(site.developer).toEqual({ name: 'Tunde', email: 'tunde@webcraft.example', autoSend: true });
    expect(JSON.stringify(site)).not.toMatch(/stop/i);
    expect((await owner.get(`/api/scans/${reportId}`)).body.report.sentToDeveloper.to).toBe('tunde@webcraft.example');
  });

  it('sends to the saved developer next time without asking again', async () => {
    const { owner, reportId, siteId } = await setUp();
    await owner.put(`/api/domains/${siteId}/developer`).send({ name: 'Tunde', email: 'tunde@webcraft.example', autoSend: false });

    const res = await owner.post(`/api/scans/${reportId}/send`).send({});
    expect(res.status).toBe(200);
    expect(testOutbox.map((e) => e.to)).toEqual(['tunde@webcraft.example']);
    expect(testOutbox[0]!.text).toContain('Hi Tunde, Sentry found 2 security problems on yourbakery.example.');
  });

  it('needs a developer, only sends the account’s own reports, and refuses bad emails', async () => {
    const { owner, reportId } = await setUp();
    expect((await owner.post(`/api/scans/${reportId}/send`).send({})).status).toBe(400);
    expect((await owner.post(`/api/scans/${reportId}/send`).send({ developer: { name: 'T', email: 'not-an-email' } })).status).toBe(400);

    const stranger = await signedInAgent(app, 'someone@else.example');
    testOutbox.length = 0;
    const res = await stranger.post(`/api/scans/${reportId}/send`).send({ developer: { name: 'X', email: 'x@spam.example' } });
    expect(res.status).toBe(404);
    expect(testOutbox).toHaveLength(0);
  });

  it('allows at most 10 sends a day per account', async () => {
    const { owner, reportId } = await setUp();
    const send = () => owner.post(`/api/scans/${reportId}/send`).send({ developer: { name: 'Tunde', email: 'tunde@webcraft.example' } });
    for (let i = 0; i < 10; i++) expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it('lets the owner change and remove the developer', async () => {
    const { owner, siteId } = await setUp();
    const put = await owner.put(`/api/domains/${siteId}/developer`).send({ name: 'Tunde', email: 'tunde@webcraft.example', autoSend: true });
    expect(put.body.domain.developer).toMatchObject({ email: 'tunde@webcraft.example', autoSend: true });

    const removed = await owner.delete(`/api/domains/${siteId}/developer`);
    expect(removed.body.domain.developer).toBeNull();
    const [row] = await db.select().from(domains).where(eq(domains.id, siteId));
    expect(row).toMatchObject({ developerEmail: null, developerAutoSend: false, developerStopToken: null });
  });
});

describe('the developer’s “Don’t send me reports” link', () => {
  it('asks first (GET changes nothing), then stops the reports without an account', async () => {
    const { owner, siteId } = await setUp();
    await owner.put(`/api/domains/${siteId}/developer`).send({ name: 'Tunde', email: 'tunde@webcraft.example', autoSend: true });
    const [row] = await db.select().from(domains).where(eq(domains.id, siteId));
    const token = row!.developerStopToken!;

    const look = await request(app).get(`/api/developer/stop?token=${token}`);
    expect(look.body).toEqual({ hostname: 'yourbakery.example', ownerName: 'Adunni' });
    expect((await db.select().from(domains).where(eq(domains.id, siteId)))[0]!.developerEmail).toBe('tunde@webcraft.example');

    const stop = await request(app).post('/api/developer/stop').set('Origin', ORIGIN).send({ token });
    expect(stop.status).toBe(200);
    expect((await db.select().from(domains).where(eq(domains.id, siteId)))[0]).toMatchObject({ developerEmail: null, developerAutoSend: false });
    expect((await request(app).post('/api/developer/stop').set('Origin', ORIGIN).send({ token })).status).toBe(404);
  });

  it('rejects made-up tokens', async () => {
    expect((await request(app).get('/api/developer/stop?token=made-up-token-1234567')).status).toBe(404);
  });
});

describe('deleting the account', () => {
  it('removes the saved developer with the website', async () => {
    const { owner, siteId } = await setUp();
    await owner.put(`/api/domains/${siteId}/developer`).send({ name: 'Tunde', email: 'tunde@webcraft.example', autoSend: true });
    await db.delete(user).where(eq(user.email, 'ada@yourbakery.example'));
    expect(await db.select().from(domains)).toHaveLength(0);
    expect(await db.select().from(scans)).toHaveLength(0);
  });
});
