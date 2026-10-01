import { describe, expect, it } from 'vitest';
import { addInterval, firstCheckAt, shouldAlert } from '../src/schedule/plan.ts';

const at = (iso: string) => new Date(iso);

describe('addInterval', () => {
  it('adds a week, or a calendar month that never spills into the month after', () => {
    expect(addInterval('weekly', at('2026-10-01T14:05:00Z')).toISOString()).toBe('2026-10-08T14:05:00.000Z');
    expect(addInterval('monthly', at('2026-10-01T14:05:00Z')).toISOString()).toBe('2026-11-01T14:05:00.000Z');
    expect(addInterval('monthly', at('2027-01-31T09:00:00Z')).toISOString()).toBe('2027-02-28T09:00:00.000Z');
  });
});

describe('firstCheckAt', () => {
  const now = at('2026-10-01T16:00:00Z');

  it('follows the last check, at about the same time of day', () => {
    expect(firstCheckAt('weekly', at('2026-10-01T14:05:00Z'), now, 0).toISOString()).toBe('2026-10-08T14:05:00.000Z');
  });

  it('skips forward when the last check was long ago, never scheduling in the past', () => {
    expect(firstCheckAt('weekly', at('2026-09-01T14:05:00Z'), now, 0).toISOString()).toBe('2026-10-06T14:05:00.000Z');
  });

  it('starts from now for a website never checked, plus a few minutes to spread websites out', () => {
    expect(firstCheckAt('monthly', null, now, 7).toISOString()).toBe('2026-11-01T16:07:00.000Z');
  });
});

describe('shouldAlert', () => {
  it('alerts when the grade drops', () => {
    expect(shouldAlert('B', 'D', [])).toBe(true);
  });

  it('alerts for a new critical or medium problem, even within the same grade', () => {
    expect(shouldAlert('C', 'C', ['medium'])).toBe(true);
    expect(shouldAlert('A', 'A', ['critical'])).toBe(true);
  });

  it('stays quiet when things stay the same, improve, or only a low problem appears', () => {
    expect(shouldAlert('C', 'C', [])).toBe(false);
    expect(shouldAlert('D', 'B', [])).toBe(false);
    expect(shouldAlert('B', 'B', ['low'])).toBe(false);
  });
});
