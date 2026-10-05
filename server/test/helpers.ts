import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import { db } from '../src/db/client.ts';
import { user } from '../src/db/schema.ts';
import { env } from '../src/env.ts';

// Better Auth rejects cross-site POSTs, so send the web app's origin like a browser would.
export const ORIGIN = env.APP_URL;
export const PASSWORD = 'correct-horse-battery';

export async function resetDatabase() {
  await db.execute(sql`truncate table "user" cascade`);
}

/** A supertest agent holding a session cookie for a freshly created account with a confirmed email. */
export async function signedInAgent(app: Express, email = 'owner@yourbakery.example') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({
    name: 'Test Owner',
    email,
    password: PASSWORD,
    acceptTerms: true,
  });
  if (res.status !== 200) throw new Error(`Test sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  // As if the owner had clicked the link in the "confirm your email" message.
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const signIn = await agent.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  if (signIn.status !== 200) throw new Error(`Test sign-in failed: ${signIn.status} ${JSON.stringify(signIn.body)}`);
  return agent;
}
