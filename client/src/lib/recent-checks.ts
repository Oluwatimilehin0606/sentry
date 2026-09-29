import type { Grade } from '@/lib/scan';

/**
 * Recent checks, kept in this browser until scans are saved on the server (Phase 5).
 * Stored per account, so two people sharing a computer don't see each other's list.
 */
export type RecentCheck = { hostname: string; grade: Grade; score: number; at: string };

const MAX = 5;
const key = (userId: string) => `sentry-recent-checks:${userId}`;

export function loadRecentChecks(userId: string): RecentCheck[] {
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? (JSON.parse(raw) as RecentCheck[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecentCheck(userId: string, check: RecentCheck): RecentCheck[] {
  const list = [check, ...loadRecentChecks(userId).filter((c) => c.hostname !== check.hostname)].slice(0, MAX);
  try {
    localStorage.setItem(key(userId), JSON.stringify(list));
  } catch {
    // Storage can be full or blocked; the list just won't persist.
  }
  return list;
}
