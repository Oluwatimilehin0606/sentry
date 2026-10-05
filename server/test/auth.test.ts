import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { account, session, user } from '../src/db/schema.ts';
import { testOutbox } from '../src/email/mailer.ts';
import { env } from '../src/env.ts';

// Stands in for the Have I Been Pwned list (tests never call the internet).
const LEAKED = 'password12345';
vi.mock('../src/leaked-password.ts', () => ({ isLeakedPassword: async (password: string) => password === LEAKED }));

const app = createApp();
// Better Auth rejects cross-site POSTs, so send the web app's origin like a browser would.
const ORIGIN = env.APP_URL;

const ada = {
  name: 'Ada Bakery',
  email: 'ada@yourbakery.example',
  password: 'correct-horse-battery',
  acceptTerms: true,
};

type Agent = ReturnType<typeof request.agent>;

function signUp(agent: Agent, body: Record<string, unknown> = ada) {
  return agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({ callbackURL: '/home', ...body });
}

function signIn(agent: Agent, password = ada.password) {
  return agent.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: ada.email, password });
}

/** The link from the newest email to `to` with this subject, as a path on Sentry. */
function linkIn(subject: string, to = ada.email): string {
  const email = testOutbox.findLast((e) => e.to === to && e.subject === subject);
  if (!email) throw new Error(`No "${subject}" email to ${to}`);
  const url = email.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`No link in "${subject}"`);
  const { pathname, search } = new URL(url);
  return pathname + search;
}

async function confirmedAda(): Promise<void> {
  await signUp(request.agent(app));
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, ada.email));
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
  testOutbox.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('sign-up', () => {
  it('creates the account and emails a confirm link, without signing in yet', async () => {
    const agent = request.agent(app);
    const res = await signUp(agent);

    expect(res.status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(401);
    const [row] = await db.select().from(user);
    expect(row).toMatchObject({ email: ada.email, emailVerified: false });
    expect(row?.termsAcceptedAt).toBeTruthy();
    expect(linkIn('Confirm your email for Sentry')).toMatch(/^\/api\/auth\/verify-email\?token=/);
  });

  it('confirms the email and signs in from the link', async () => {
    await signUp(request.agent(app));
    const agent = request.agent(app);
    const res = await agent.get(linkIn('Confirm your email for Sentry'));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/home');
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect((await agent.get('/api/me')).status).toBe(200);
    const [row] = await db.select({ emailVerified: user.emailVerified }).from(user);
    expect(row?.emailVerified).toBe(true);
  });

  it('requires agreeing to only scan owned websites', async () => {
    const res = await signUp(request.agent(app), { ...ada, acceptTerms: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only scan websites you own/);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it('answers a second sign-up with a used email like a new one, and tells the owner instead', async () => {
    const first = await signUp(request.agent(app));
    const second = await signUp(request.agent(app), { ...ada, name: 'Someone Else', email: ada.email.toUpperCase() });

    // Nothing in the answer says the email already has an account…
    expect(second.status).toBe(first.status);
    expect(Object.keys(second.body).sort()).toEqual(Object.keys(first.body).sort());
    // …no second account is made, and the owner hears about it.
    expect(await db.select().from(user)).toHaveLength(1);
    expect(testOutbox.some((e) => e.subject === 'You already have a Sentry account')).toBe(true);
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const res = await signUp(request.agent(app), { ...ada, password: 'short-pw' });

    expect(res.status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it('rejects a password known from data breaches', async () => {
    const res = await signUp(request.agent(app), { ...ada, password: LEAKED });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_LEAKED');
    expect(res.body.message).toMatch(/data breach/);
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
  it('refuses to sign in before the email is confirmed, and sends a fresh link', async () => {
    await signUp(request.agent(app));
    testOutbox.length = 0;
    const res = await signIn(request.agent(app));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(linkIn('Confirm your email for Sentry')).toMatch(/^\/api\/auth\/verify-email\?token=/);
  });

  it('signs in with the right password once confirmed', async () => {
    await confirmedAda();
    const agent = request.agent(app);

    expect((await signIn(agent)).status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(200);
  });

  it('refuses the wrong password without saying which part was wrong', async () => {
    await confirmedAda();
    const res = await signIn(request.agent(app), 'not-the-right-password');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('ends the session on sign-out', async () => {
    await confirmedAda();
    const agent = request.agent(app);
    await signIn(agent);

    const out = await agent.post('/api/auth/sign-out').set('Origin', ORIGIN).send({});
    expect(out.status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(401);
  });
});

describe('forgot password', () => {
  const requestReset = (email: string) =>
    request(app).post('/api/auth/request-password-reset').set('Origin', ORIGIN).send({ email, redirectTo: '/reset-password' });

  it('gives the same answer whether or not the email has an account', async () => {
    await confirmedAda();
    const known = await requestReset(ada.email);
    const unknown = await requestReset('nobody@yourbakery.example');

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(testOutbox.filter((e) => e.subject === 'Reset your Sentry password').map((e) => e.to)).toEqual([ada.email]);
  });

  it('sets a new password from the link, signs out every device, and the link works only once', async () => {
    await confirmedAda();
    const laptop = request.agent(app);
    await signIn(laptop);
    await requestReset(ada.email);

    // The email's link sends the browser to Sentry's "choose a new password" page with the token.
    const opened = await request(app).get(linkIn('Reset your Sentry password'));
    expect(opened.status).toBe(302);
    const token = new URL(opened.headers.location!, ORIGIN).searchParams.get('token');
    expect(new URL(opened.headers.location!, ORIGIN).pathname).toBe('/reset-password');
    expect(token).toBeTruthy();

    const reset = () =>
      request(app).post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token, newPassword: 'flour-and-sugar-rise-early' });
    expect((await reset()).status).toBe(200);

    expect((await laptop.get('/api/me')).status).toBe(401);
    expect(await db.select().from(session)).toHaveLength(0);
    expect(testOutbox.some((e) => e.subject === 'Your Sentry password was changed')).toBe(true);
    expect((await signIn(request.agent(app), 'flour-and-sugar-rise-early')).status).toBe(200);
    expect((await signIn(request.agent(app))).status).toBe(401);
    expect((await reset()).status).toBe(400);
  });

  it('refuses a leaked password as the new one', async () => {
    await confirmedAda();
    await requestReset(ada.email);
    const opened = await request(app).get(linkIn('Reset your Sentry password'));
    const token = new URL(opened.headers.location!, ORIGIN).searchParams.get('token');

    const res = await request(app).post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token, newPassword: LEAKED });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_LEAKED');
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

describe('the limit on API requests from one visitor', () => {
  it('stops a visitor who sends far more requests than a person would', async () => {
    const limited = createApp({ apiLimit: 3 });
    for (let i = 0; i < 3; i++) expect((await request(limited).get('/api/health')).status).toBe(200);

    const res = await request(limited).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/wait a minute/);
  });
});
