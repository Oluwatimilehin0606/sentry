import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { domains, scans, user } from '../src/db/schema.ts';
import { alertEmail } from '../src/email/alert.ts';
import type { Email } from '../src/email/mailer.ts';
import type { Finding } from '../src/scanner/checks.ts';
import { buildReport } from '../src/scanner/scan.ts';
import { runAutomaticCheck, runDueChecks } from '../src/schedule/runner.ts';
import { saveScan } from '../src/scans/store.ts';
import { startFixture, type Fixture } from './fixture-server.ts';
import { resetDatabase, signedInAgent } from './helpers.ts';

const app = createApp();
let owner: Awaited<ReturnType<typeof signedInAgent>>;
let ownerId = '';
let fixture: Fixture | undefined;

beforeAll(async () => {
  await resetDatabase();
  owner = await signedInAgent(app, 'owner@yourbakery.example');
  ownerId = (await db.select().from(user).where(eq(user.email, 'owner@yourbakery.example')))[0]!.id;
});

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

afterAll(async () => {
  await pool.end();
});

describe('automatic check settings', () => {
  it('only lets verified websites have automatic checks', async () => {
    const site = (await owner.post('/api/domains').send({ domain: 'shop.yourbakery.example' })).body.domain;
    const res = await owner.patch(`/api/domains/${site.id}`).send({ rescanInterval: 'weekly' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Prove shop.yourbakery.example is yours first/);
  });

  it('schedules the next check a week after the last one, and switches off cleanly', async () => {
    const site = (await owner.post('/api/domains').send({ domain: 'yourbakery.example' })).body.domain;
    await db.update(domains).set({ verifiedAt: new Date() }).where(eq(domains.id, site.id));
    const lastCheck = new Date(Date.now() - 2 * 60 * 60 * 1000); // two hours ago
    await db.insert(scans).values({ userId: ownerId, hostname: 'yourbakery.example', mode: 'full', status: 'done', createdAt: lastCheck });

    const on = await owner.patch(`/api/domains/${site.id}`).send({ rescanInterval: 'weekly' });
    expect(on.body.domain).toMatchObject({ rescanInterval: 'weekly', alertsEnabled: true });
    const next = new Date(on.body.domain.nextCheckAt).getTime();
    const weekAfter = lastCheck.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(next).toBeGreaterThanOrEqual(weekAfter);
    expect(next).toBeLessThan(weekAfter + 20 * 60 * 1000); // within the spreading minutes

    const quiet = await owner.patch(`/api/domains/${site.id}`).send({ alertsEnabled: false });
    expect(quiet.body.domain).toMatchObject({ rescanInterval: 'weekly', alertsEnabled: false, nextCheckAt: on.body.domain.nextCheckAt });

    const off = await owner.patch(`/api/domains/${site.id}`).send({ rescanInterval: 'none' });
    expect(off.body.domain).toMatchObject({ rescanInterval: 'none', nextCheckAt: null });
    expect((await owner.patch(`/api/domains/${site.id}`).send({ rescanInterval: 'daily' })).status).toBe(400);
  });
});

describe('running automatic checks', () => {
  const allPass: Finding[] = [
    { checkId: 'tls.no_https', status: 'pass' },
    { checkId: 'header.hsts_missing', status: 'pass' },
    { checkId: 'header.csp_missing', status: 'pass' },
    { checkId: 'http.no_https_redirect', status: 'pass' },
  ];

  /** A verified "localhost" website whose weekly check is overdue, last checked with an A. */
  async function dueWebsite(alertsEnabled: boolean) {
    await db.delete(domains).where(and(eq(domains.userId, ownerId), eq(domains.hostname, 'localhost')));
    await db.delete(scans).where(and(eq(scans.userId, ownerId), eq(scans.hostname, 'localhost')));
    const last = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await saveScan(ownerId, buildReport({ hostname: 'localhost', mode: 'full', scannedAt: last.toISOString(), durationMs: 900, findings: allPass }));
    const [row] = await db
      .insert(domains)
      .values({
        userId: ownerId,
        hostname: 'localhost',
        verifyToken: '0000000000000000',
        verifiedAt: last,
        rescanInterval: 'weekly',
        nextCheckAt: new Date(Date.now() - 60_000),
        alertsEnabled,
      })
      .returning();
    return row!;
  }

  it('checks overdue websites, saves the check as automatic, and emails when it got worse', async () => {
    const site = await dueWebsite(true);
    // The website has since lost its security headers and redirect.
    fixture = await startFixture({ http: 'serve' });
    const sent: Email[] = [];
    const results = await runDueChecks({
      contextFor: () => fixture!.ctx,
      send: async (email) => (sent.push(email), true),
    });

    expect(results).toEqual([{ hostname: 'localhost', outcome: 'alerted' }]);
    const [saved] = await db.select().from(scans).where(and(eq(scans.userId, ownerId), eq(scans.trigger, 'scheduled')));
    expect(saved).toMatchObject({ hostname: 'localhost', mode: 'full', status: 'done' });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('owner@yourbakery.example');
    expect(sent[0]!.subject).toMatch(/^localhost dropped from an A to (a D|an F)$/);
    expect(sent[0]!.text).toContain('Browsers aren’t told to always use a secure connection');
    expect(sent[0]!.text).toContain(`/reports/${saved!.id}`);
    expect(sent[0]!.text).toContain('/websites/localhost?alerts=off');

    // The next check moved on a week, so running again straight away does nothing.
    const [after] = await db.select().from(domains).where(eq(domains.id, site.id));
    expect(after!.nextCheckAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(await runDueChecks({ contextFor: () => fixture!.ctx, send: async () => true })).toEqual([]);
  });

  it('checks but stays quiet when email alerts are off', async () => {
    await dueWebsite(false);
    fixture = await startFixture({ http: 'serve' });
    const sent: Email[] = [];
    const results = await runDueChecks({ contextFor: () => fixture!.ctx, send: async (e) => (sent.push(e), true) });
    expect(results).toEqual([{ hostname: 'localhost', outcome: 'checked' }]);
    expect(sent).toEqual([]);
  });

  it('reports what one check found, for "Run it now"', async () => {
    const site = await dueWebsite(true);
    fixture = await startFixture({ http: 'serve' });
    const result = await runAutomaticCheck(
      { id: site.id, user_id: ownerId, hostname: 'localhost', rescan_interval: 'weekly', alerts_enabled: true },
      { contextFor: () => fixture!.ctx, send: async () => true },
    );

    expect(result).toMatchObject({ outcome: 'alerted', previous: { grade: 'A', score: 100 }, emailedTo: 'owner@yourbakery.example' });
    expect(result.current!.grade).toMatch(/^[DF]$/);
    const [saved] = await db.select().from(scans).where(eq(scans.id, result.scanId!));
    expect(saved).toMatchObject({ trigger: 'scheduled', mode: 'full' });
  });

  describe('"Run it now" on the website page', () => {
    it('needs a verified website with automatic checks on', async () => {
      const site = (await owner.post('/api/domains').send({ domain: 'quiet.yourbakery.example' })).body.domain;
      const res = await owner.post(`/api/domains/${site.id}/run-now`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Turn on automatic checks for quiet.yourbakery.example first.');
    });

    it('counts as this week’s check, and explains plainly when the website can’t be reached', async () => {
      // "localhost" is this machine, which real checks refuse, so the check can't reach it.
      const site = await dueWebsite(true);
      const res = await owner.post(`/api/domains/${site.id}/run-now`);

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('We couldn’t reach localhost just now. Check it’s online, then try again.');
      expect(new Date(res.body.domain.nextCheckAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    });

    it('can’t run another account’s website', async () => {
      const site = await dueWebsite(true);
      const stranger = await signedInAgent(app, 'stranger@elsewhere.example');
      expect((await stranger.post(`/api/domains/${site.id}/run-now`)).status).toBe(404);
    });
  });
});

describe('alert email', () => {
  it('escapes names in the HTML and includes a plain-text version', () => {
    const email = alertEmail({
      hostname: 'bad<script>.example',
      interval: 'weekly',
      previous: { grade: 'B', score: 82 },
      current: { grade: 'D', score: 62, scannedAt: '2026-10-08T13:03:00Z' },
      appeared: [{ title: 'Browsers aren’t told to always use a secure connection', severity: 'medium' }],
      reportUrl: 'http://localhost:5173/reports/abc',
      settingsUrl: 'http://localhost:5173/websites/x?alerts=off',
      timeZone: 'Africa/Lagos',
    });
    expect(email.subject).toBe('bad<script>.example dropped from a B to a D');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('bad&lt;script&gt;.example');
    expect(email.text).toContain('B → D (82 → 62 out of 100), checked Thu 8 Oct, 14:03 GMT+1.');
    expect(email.text).toContain('- [Medium] Browsers aren’t told to always use a secure connection');
  });

  it('shows the logo as a picture from Sentry’s own site', () => {
    const email = alertEmail({
      hostname: 'yourbakery.example',
      interval: 'weekly',
      previous: { grade: 'A', score: 96 },
      current: { grade: 'F', score: 28, scannedAt: '2026-10-08T13:03:00Z' },
      appeared: [],
      reportUrl: 'https://csentinel.com.ng/reports/abc',
      settingsUrl: 'https://csentinel.com.ng/websites/x?alerts=off',
      timeZone: 'Africa/Lagos',
    });
    expect(email.html).toContain('<img src="https://csentinel.com.ng/email-logo.png"');
  });
});
