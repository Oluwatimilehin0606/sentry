import { describe, expect, it } from 'vitest';
import { latestPerWebsite, timeAgo, whenChecked, type ScanSummary } from '@/lib/reports';

const now = new Date(2026, 9, 1, 15, 0); // 1 Oct 2026, 15:00 local time

describe('whenChecked', () => {
  it('says Today, Yesterday, or the date', () => {
    expect(whenChecked(new Date(2026, 9, 1, 14, 5).toISOString(), now)).toBe('Today, 14:05');
    expect(whenChecked(new Date(2026, 8, 30, 9, 14).toISOString(), now)).toBe('Yesterday, 09:14');
    // Newer browsers write September as "Sept" in British English; either is fine.
    expect(whenChecked(new Date(2026, 8, 29, 9, 14).toISOString(), now)).toMatch(/^29 Sept? 2026, 09:14$/);
  });
});

describe('timeAgo', () => {
  it.each([
    [0, 'just now'],
    [1, '1 minute ago'],
    [45, '45 minutes ago'],
    [120, '2 hours ago'],
    [60 * 72, '3 days ago'],
  ])('%i minutes → %s', (minutes, text) => {
    expect(timeAgo(new Date(now.getTime() - minutes * 60_000).toISOString(), now.getTime())).toBe(text);
  });
});

describe('latestPerWebsite', () => {
  it('keeps the newest check of each website, in order', () => {
    const s = (id: string, hostname: string): ScanSummary => ({
      id,
      hostname,
      mode: 'light',
      score: 50,
      grade: 'F',
      scannedAt: '2026-10-01T00:00:00Z',
    });
    const list = [s('1', 'a.example'), s('2', 'b.example'), s('3', 'a.example')];
    expect(latestPerWebsite(list).map((x) => x.id)).toEqual(['1', '2']);
    expect(latestPerWebsite(undefined)).toEqual([]);
  });
});
