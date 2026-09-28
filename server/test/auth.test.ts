import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { account, user } from '../src/db/schema.ts';
import { env } from '../src/env.ts';

const app = createApp();
// Better Auth rejects cross-site POSTs, so send the web app's origin like a browser would.
const ORIGIN = env.APP_URL;

const ada = {
  name: 'Ada Bakery',
  email: 'ada@yourbakery.example',
  password: 'correct-horse-battery',
  acceptTerms: true,
};

function signUp(agent: ReturnType<typeof request.agent>, body: Record<string, unknown> = ada) {
  return agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send(body);
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
});

afterAll(async () => {
  await pool.end();
});

describe('sign-up', () => {
  it('creates an account, signs the user in and records terms acceptance', async () => {
    const agent = request.agent(app);
    const res = await signUp(agent);

    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ name: ada.name, email: ada.email });
    expect(me.body.user.termsAcceptedAt).toBeTruthy();
  });

  it('requires agreeing to only scan owned websites', async () => {
    const res = await signUp(request.agent(app), { ...ada, acceptTerms: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only scan websites you own/);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it('rejects a second account with the same email', async () => {
    await signUp(request.agent(app));
    const res = await signUp(request.agent(app), { ...ada, email: ada.email.toUpperCase() });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const res = await signUp(request.agent(app), { ...ada, password: 'short-pw' });

    expect(res.status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it('stores a password hash, never the password itself', async () => {
    await signUp(request.agent(app));
    const [row] = await db.select({ password: account.password }).from(account);

    expect(row?.password).toBeTruthy();
    expect(row?.password).not.toContain(ada.password);
  });
});

describe('sign-in and sign-out', () => {
  beforeEach(async () => {
    await signUp(request.agent(app));
  });

  it('signs in with the right password', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: ada.email, password: ada.password });

    expect(res.status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(200);
  });

  it('refuses the wrong password without saying which part was wrong', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: ada.email, password: 'not-the-right-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('ends the session on sign-out', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: ada.email, password: ada.password });

    const out = await agent.post('/api/auth/sign-out').set('Origin', ORIGIN).send({});
    expect(out.status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(401);
  });
});

describe('protected routes', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please sign in to continue.');
  });

  it('deleting a user removes their sessions and accounts', async () => {
    await signUp(request.agent(app));
    const [u] = await db.select({ id: user.id }).from(user);
    await db.delete(user).where(eq(user.id, u!.id));

    expect(await db.select().from(account)).toHaveLength(0);
  });
});
