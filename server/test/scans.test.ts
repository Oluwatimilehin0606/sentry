import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { db, pool } from '../src/db/client.ts';
import { scans, user } from '../src/db/schema.ts';
import { DAILY_LIMIT } from '../src/routes/scan.ts';
import type { Finding } from '../src/scanner/checks.ts';
import { buildReport, type ScanReport } from '../src/scanner/scan.ts';
import { saveScan } from '../src/scans/store.ts';
import { resetDatabase, signedInAgent } from './helpers.ts';

const app = createApp();
let owner: Awaited<ReturnType<typeof signedInAgent>>;
let stranger: Awaited<ReturnType<typeof signedInAgent>>;
let ownerId: string;

/** A made-up report, as if a check had just finished (no network involved). */
function fakeReport(hostname: string, findings: Finding[], scannedAt: string, mode: 'full' | 'light' = 'light'): ScanReport {
  return buildReport({ hostname, mode, scannedAt, durationMs: 1200, finalUrl: `https://${hostname}/`, findings });
}

const MIXED: Finding[] = [
  { checkId: 'tls.no_https', status: 'pass', evidence: 'https://yourbakery.example/ answered 200' },
  { checkId: 'header.xcto_missing', status: 'fail', evidence: 'X-Content-Type-Options: nosniff not set' },
  { checkId: 'header.csp_missing', status: 'fail' },
  { checkId: 'http.no_https_redirect', status: 'fail', evidence: 'http:// answered 200' },
  { checkId: 'header.hsts_missing', status: 'pass' },
];

beforeAll(async () => {
  await resetDatabase();
  owner = await signedInAgent(app, 'owner@yourbakery.example');
  stranger = await signedInAgent(app, 'stranger@elsewhere.example');
  const [row] = await db.select().from(user).where(eq(user.email, 'owner@yourbakery.example'));
  ownerId = row!.id;
});

afterAll(async () => {
  await pool.end();
});

describe('saved reports', () => {
  let savedId = '';
  const original = fakeReport('yourbakery.example', MIXED, '2026-10-01T10:00:00.000Z');

  it('saves a check and reads it back exactly as it was shown', async () => {
    savedId = await saveScan(ownerId, original);
    const res = await owner.get(`/api/scans/${savedId}`);
    expect(res.status).toBe(200);
    const { id, changes, trigger, ...report } = res.body.report;
    expect(id).toBe(savedId);
    expect(trigger).toBe('manual');
    expect(changes).toBeNull(); // the website's first check
    expect(report).toEqual(JSON.parse(JSON.stringify(original)));
  });

  it('puts findings in one fixed order, so the summary names the same first fix', () => {
    const shuffled = fakeReport('yourbakery.example', [...MIXED].reverse(), '2026-10-01T10:00:00.000Z');
    expect(shuffled.summary).toBe(original.summary);
    expect(shuffled.findings.map((f) => f.checkId)).toEqual(original.findings.map((f) => f.checkId));
  });

  it('lists checks newest first, filters by website and pages through older ones', async () => {
    await saveScan(ownerId, fakeReport('example.com', MIXED, '2026-10-01T11:00:00.000Z'));
    await saveScan(ownerId, fakeReport('yourbakery.example', MIXED, '2026-10-01T12:00:00.000Z', 'full'));

    const all = await owner.get('/api/scans');
    expect(all.body.scans.map((s: { hostname: string }) => s.hostname)).toEqual([
      'yourbakery.example',
      'example.com',
      'yourbakery.example',
    ]);
    expect(all.body.scans[0]).toMatchObject({ mode: 'full', grade: expect.any(String), scannedAt: '2026-10-01T12:00:00.000Z' });

    const bakery = await owner.get('/api/scans').query({ hostname: 'yourbakery.example' });
    expect(bakery.body.scans).toHaveLength(2);

    const first = await owner.get('/api/scans').query({ limit: 2 });
    expect(first.body).toMatchObject({ more: true });
    const next = await owner.get('/api/scans').query({ limit: 2, before: first.body.scans[1].scannedAt });
    expect(next.body).toMatchObject({ more: false, scans: [{ id: savedId }] });
  });

  it('keeps each account’s reports to itself', async () => {
    expect((await stranger.get('/api/scans')).body.scans).toEqual([]);
    expect((await stranger.get(`/api/scans/${savedId}`)).status).toBe(404);
    expect((await owner.get('/api/scans/not-a-uuid')).status).toBe(404);
    expect((await request(app).get('/api/scans')).status).toBe(401);
  });
});

describe('changes since the last check', () => {
  it('compares each check with the same website’s previous one', async () => {
    const [row] = await db.select().from(user).where(eq(user.email, 'stranger@elsewhere.example'));
    const me = row!.id;
    const first = fakeReport('shop.example', [
      { checkId: 'header.hsts_missing', status: 'fail' },
      { checkId: 'http.no_https_redirect', status: 'fail' },
      { checkId: 'header.xcto_missing', status: 'fail' },
      { checkId: 'header.server_version_leak', status: 'pass' },
    ], '2026-09-29T09:00:00.000Z', 'full');
    // Fixed HSTS and the redirect, but a version number started leaking.
    const second = fakeReport('shop.example', [
      { checkId: 'header.hsts_missing', status: 'pass' },
      { checkId: 'http.no_https_redirect', status: 'pass' },
      { checkId: 'header.xcto_missing', status: 'fail' },
      { checkId: 'header.server_version_leak', status: 'fail' },
    ], '2026-10-01T09:00:00.000Z', 'full');
    await saveScan(me, first);
    const secondId = await saveScan(me, second);

    const res = await stranger.get(`/api/scans/${secondId}`);
    expect(res.body.report.changes).toMatchObject({
      previous: { score: first.score, grade: first.grade },
      fixed: [
        { checkId: 'http.no_https_redirect', title: 'Visitors are moved to the secure version of your site' },
        { checkId: 'header.hsts_missing', title: 'Browsers are told to always use a secure connection' },
      ],
      appeared: ['header.server_version_leak'],
      stillFailing: 1,
    });

    const list = await stranger.get('/api/scans').query({ hostname: 'shop.example' });
    expect(list.body.scans.map((s: { change: unknown }) => s.change)).toEqual([
      { scoreDelta: second.score - first.score, fixed: 2, appeared: 1 },
      null,
    ]);
  });
});

describe('daily limit', () => {
  it(`stops new checks after ${DAILY_LIMIT} in 24 hours, before any scanning starts`, async () => {
    const [row] = await db.select().from(user).where(eq(user.email, 'stranger@elsewhere.example'));
    const now = new Date();
    await db.insert(scans).values(
      Array.from({ length: DAILY_LIMIT }, () => ({
        userId: row!.id,
        hostname: 'example.com',
        mode: 'light' as const,
        status: 'done' as const,
        createdAt: now,
      })),
    );
    const res = await stranger.post('/api/scan').send({ domain: 'example.com' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/50 checks in the last 24 hours/);
  });
});
