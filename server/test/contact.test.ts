import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

process.env.CONTACT_EMAIL = 'inbox@sentry.example';
const { createApp } = await import('../src/app.ts');
const { pool } = await import('../src/db/client.ts');
const { testOutbox } = await import('../src/email/mailer.ts');
const { ORIGIN, resetDatabase, signedInAgent } = await import('./helpers.ts');

const message = {
  name: 'Adunni Bakare',
  email: 'ada@yourbakery.example',
  topic: 'report',
  message: 'My website got an F. My developer removed the file but the grade is still F. What should I do?',
};

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('Contact us', () => {
  it('emails the message to Sentry’s inbox, with replies going to the sender', async () => {
    const res = await request(createApp()).post('/api/contact').set('Origin', ORIGIN).send(message);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true, copy: false });
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({
      to: 'inbox@sentry.example',
      replyTo: 'Adunni Bakare <ada@yourbakery.example>',
      subject: '[Contact] A question about my report: Adunni Bakare',
    });
    expect(testOutbox[0]!.text).toContain('the grade is still F');
    expect(testOutbox[0]!.text).toContain('not signed in');
  });

  it('sends a signed-in sender a copy (only to their own address)', async () => {
    const app = createApp();
    const agent = await signedInAgent(app, 'ada@yourbakery.example');
    testOutbox.length = 0; // (the sign-up's confirm email)
    const res = await agent.post('/api/contact').send(message);

    expect(res.body).toEqual({ sent: true, copy: true });
    expect(testOutbox.map((e) => e.to)).toEqual(['inbox@sentry.example', 'ada@yourbakery.example']);
    expect(testOutbox[0]!.text).toContain('signed in as ada@yourbakery.example');

    testOutbox.length = 0;
    await agent.post('/api/contact').send({ ...message, email: 'someone-else@example.com' });
    expect(testOutbox.map((e) => e.to)).toEqual(['inbox@sentry.example']);
  });

  it('quietly drops messages from bots that fill in the hidden field', async () => {
    const res = await request(createApp()).post('/api/contact').set('Origin', ORIGIN).send({ ...message, website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });

  it('refuses empty or oversized messages and unknown topics', async () => {
    const app = createApp();
    const post = (body: object) => request(app).post('/api/contact').set('Origin', ORIGIN).send(body);
    expect((await post({ ...message, message: 'hi' })).status).toBe(400);
    expect((await post({ ...message, message: 'x'.repeat(2001) })).status).toBe(400);
    expect((await post({ ...message, topic: 'sales' })).status).toBe(400);
    expect((await post({ ...message, email: 'not-an-email' })).status).toBe(400);
    expect(testOutbox).toHaveLength(0);
  });

  it('allows 3 messages an hour per visitor', async () => {
    const app = createApp();
    const post = () => request(app).post('/api/contact').set('Origin', ORIGIN).send(message);
    for (let i = 0; i < 3; i++) expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
  });
});
