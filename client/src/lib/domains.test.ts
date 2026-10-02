import { describe, expect, it } from 'vitest';
import { isCoveredBy, recordName, runNowSummary, type Domain, type RunNowResult } from '@/lib/domains';

describe('recordName', () => {
  it.each([
    ['yourbakery.com', '@'],
    ['mechspec.com.ng', '@'],
    ['yourbakery.co.uk', '@'],
    ['shop.yourbakery.com', 'shop'],
    ['shop.yourbakery.com.ng', 'shop'],
    ['a.b.yourbakery.com', 'a.b'],
  ])('%s → %s', (hostname, name) => {
    expect(recordName(hostname)).toBe(name);
  });
});

describe('isCoveredBy', () => {
  const site = (hostname: string, verified: boolean): Domain => ({
    id: hostname,
    hostname,
    verifiedAt: verified ? '2026-10-01T00:00:00Z' : null,
    createdAt: '2026-10-01T00:00:00Z',
    record: { type: 'TXT', value: 'sentry-verify=0' },
    rescanInterval: 'none',
    nextCheckAt: null,
    alertsEnabled: true,
  });

  it('matches the server: a verified domain covers itself and its subdomains only', () => {
    const list = [site('yourbakery.com', true), site('other.example', false)];
    expect(isCoveredBy(list, 'yourbakery.com')).toBe(true);
    expect(isCoveredBy(list, 'shop.yourbakery.com')).toBe(true);
    expect(isCoveredBy(list, 'notyourbakery.com')).toBe(false);
    expect(isCoveredBy(list, 'other.example')).toBe(false);
    expect(isCoveredBy(undefined, 'yourbakery.com')).toBe(false);
  });
});

describe('runNowSummary', () => {
  const run = (over: Partial<RunNowResult>): RunNowResult => ({
    outcome: 'checked',
    scanId: 'abc',
    previous: { grade: 'A', score: 96 },
    current: { grade: 'A', score: 96 },
    emailedTo: null,
    ...over,
  });

  it('says it dropped, and where the email went', () => {
    const r = run({ outcome: 'alerted', current: { grade: 'F', score: 28 }, emailedTo: 'alerts@sentry.example' });
    expect(runNowSummary('bakery.test', r)).toEqual({
      worse: true,
      text: 'bakery.test dropped from an A to an F.',
      email: 'Alert email sent to alerts@sentry.example.',
    });
  });

  it('still shows a drop when email alerts are off', () => {
    expect(runNowSummary('bakery.test', run({ current: { grade: 'C', score: 74 } }))).toEqual({
      worse: true,
      text: 'bakery.test dropped from an A to a C.',
    });
  });

  it('names a new problem when the grade held', () => {
    const r = run({ outcome: 'alerted', previous: { grade: 'B', score: 86 }, current: { grade: 'B', score: 80 }, emailedTo: 'a@b.example' });
    expect(runNowSummary('bakery.test', r)).toEqual({
      worse: true,
      text: 'bakery.test has a new problem to fix.',
      email: 'Alert email sent to a@b.example.',
    });
  });

  it('is calm when nothing got worse', () => {
    expect(runNowSummary('bakery.test', run({}))).toEqual({ worse: false, text: 'Checked just now: still an A (96). No email needed.' });
    expect(runNowSummary('bakery.test', run({ previous: { grade: 'C', score: 72 }, current: { grade: 'B', score: 84 } })).text).toBe(
      'Checked just now: up from a C to a B (84).',
    );
    expect(runNowSummary('bakery.test', run({ previous: null })).text).toBe('Checked just now: an A (96).');
  });
});
