import { sql } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import { db } from '../src/db/client.ts';
import { env } from '../src/env.ts';

// Better Auth rejects cross-site POSTs, so send the web app's origin like a browser would.
export const ORIGIN = env.APP_URL;

export async function resetDatabase() {
  await db.execute(sql`truncate table "user" cascade`);
}

/** A supertest agent holding a session cookie for a freshly created account. */
export async function signedInAgent(app: Express, email = 'owner@yourbakery.example') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({
    name: 'Test Owner',
    email,
    password: 'correct-horse-battery',
    acceptTerms: true,
  });
  if (res.status !== 200) throw new Error(`Test sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
