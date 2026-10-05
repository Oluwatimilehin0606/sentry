import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The demo account is recognised by its email (DEMO_EMAIL), read once when the app loads.
process.env.DEMO_EMAIL = 'adunni@demo.example';
vi.mock('../src/leaked-password.ts', () => ({ isLeakedPassword: async (password: string) => password === 'password12345' }));
const { createApp } = await import('../src/app.ts');
const { db, pool } = await import('../src/db/client.ts');
const { domains, scans, session, user } = await import('../src/db/schema.ts');
const { testOutbox } = await import('../src/email/mailer.ts');
const { ORIGIN, PASSWORD, resetDatabase, signedInAgent } = await import('./helpers.ts');

const app = createApp();
const EMAIL = 'owner@yourbakery.example';

type Agent = Awaited<ReturnType<typeof signedInAgent>>;

/** A second device signed in to the same account. */
async function anotherDevice(userAgent: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGIN)
    .set('User-Agent', userAgent)
    .send({ email: EMAIL, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('the Account page’s details', () => {
  it('counts what the account holds', async () => {
    const me = await signedInAgent(app, EMAIL);
    await me.post('/api/domains').send({ domain: 'yourbakery.example' });

    const res = await me.get('/api/me');
    expect(res.body.user).toMatchObject({ email: EMAIL, emailVerified: true });
    expect(res.body.counts).toEqual({ websites: 1, reports: 0 });
  });
});

describe('change password', () => {
  const change = (agent: Agent, body: Record<string, unknown>) =>
    agent.post('/api/auth/change-password').set('Origin', ORIGIN).send({ revokeOtherSessions: true, ...body });

  it('needs the current password, signs out every other device, and emails the owner', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    const phone = await anotherDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile');

    expect((await change(laptop, { currentPassword: 'not-my-password', newPassword: 'flour-and-sugar-rise-early' })).status).toBe(400);
    expect((await change(laptop, { currentPassword: PASSWORD, newPassword: 'flour-and-sugar-rise-early' })).status).toBe(200);

    expect((await laptop.get('/api/me')).status).toBe(200);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect(testOutbox.map((e) => e.subject)).toContain('Your Sentry password was changed');
  });

  it('refuses a leaked password', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    const res = await change(laptop, { currentPassword: PASSWORD, newPassword: 'password12345' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_LEAKED');
    expect(testOutbox.map((e) => e.subject)).not.toContain('Your Sentry password was changed');
  });
});

describe('where you’re signed in', () => {
  it('lists this account’s devices, this one first, without session tokens', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    await anotherDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1');
    await signedInAgent(app, 'someone@else.example');

    const res = await laptop.get('/api/me/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions[0].current).toBe(true);
    expect(res.body.sessions[1].userAgent).toMatch(/iPhone/);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });

  it('signs out one other device, but only this account’s', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    const phone = await anotherDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile');
    const stranger = await signedInAgent(app, 'someone@else.example');
    const phoneId = (await laptop.get('/api/me/sessions')).body.sessions[1].id;

    expect((await stranger.delete(`/api/me/sessions/${phoneId}`)).status).toBe(404);
    expect((await phone.get('/api/me')).status).toBe(200);

    expect((await laptop.delete(`/api/me/sessions/${phoneId}`)).status).toBe(204);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect((await laptop.get('/api/me')).status).toBe(200);
  });

  it('won’t sign out this device from the list', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    const thisId = (await laptop.get('/api/me/sessions')).body.sessions[0].id;

    expect((await laptop.delete(`/api/me/sessions/${thisId}`)).status).toBe(400);
  });

  it('signs out everywhere else', async () => {
    const laptop = await signedInAgent(app, EMAIL);
    const phone = await anotherDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile');

    expect((await laptop.post('/api/auth/revoke-other-sessions').set('Origin', ORIGIN).send({})).status).toBe(200);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect((await laptop.get('/api/me/sessions')).body.sessions).toHaveLength(1);
  });
});

describe('download my data', () => {
  it('gives the account’s own data as a file, never the password or tokens', async () => {
    const me = await signedInAgent(app, EMAIL);
    await me.post('/api/domains').send({ domain: 'yourbakery.example' });
    await signedInAgent(app, 'someone@else.example').then((a) => a.post('/api/domains').send({ domain: 'theirs.example' }));

    const res = await me.get('/api/me/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="sentry-my-data-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.headers['cache-control']).toBe('no-store');
    const data = JSON.parse(res.text);
    expect(data.account).toMatchObject({ email: EMAIL, emailConfirmed: true });
    expect(data.websites.map((w: { hostname: string }) => w.hostname)).toEqual(['yourbakery.example']);
    expect(data.signIns).toHaveLength(1);
    expect(res.text).not.toMatch(/theirs\.example|someone@else/);
    expect(res.text).not.toMatch(/"(password|token)"/i);
  });
});

describe('delete account', () => {
  const remove = (agent: Agent, body: Record<string, unknown>) =>
    agent.post('/api/auth/delete-user').set('Origin', ORIGIN).send(body);

  it('always needs the right password', async () => {
    const me = await signedInAgent(app, EMAIL);

    expect((await remove(me, {})).body.code).toBe('PASSWORD_REQUIRED');
    expect((await remove(me, { password: 'not-my-password' })).status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it('deletes the account and everything in it, signs out everywhere, and sends a receipt', async () => {
    const me = await signedInAgent(app, EMAIL);
    const phone = await anotherDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile');
    await me.post('/api/domains').send({ domain: 'yourbakery.example' });
    const [owner] = await db.select().from(user).where(eq(user.email, EMAIL));
    await db.insert(scans).values({ userId: owner!.id, hostname: 'yourbakery.example', mode: 'light', status: 'done' });

    expect((await remove(me, { password: PASSWORD })).status).toBe(200);

    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(domains)).toHaveLength(0);
    expect(await db.select().from(scans)).toHaveLength(0);
    expect(await db.select().from(session)).toHaveLength(0);
    expect((await me.get('/api/me')).status).toBe(401);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect(testOutbox.map((e) => e.subject)).toContain('Your Sentry account was deleted');
  });

  it('never deletes the demo account', async () => {
    const demo = await signedInAgent(app, 'adunni@demo.example');

    const res = await remove(demo, { password: PASSWORD });
    expect(res.status).toBe(403);
    expect((await demo.get('/api/me')).body.isDemo).toBe(true);
  });
});
