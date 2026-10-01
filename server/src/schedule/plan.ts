import type { Severity } from '../scanner/catalog.ts';

export type RescanInterval = 'none' | 'weekly' | 'monthly';

/** One interval after `from` (a calendar month for monthly, so 31 Jan → 28/29 Feb). */
export function addInterval(interval: Exclude<RescanInterval, 'none'>, from: Date): Date {
  const next = new Date(from);
  if (interval === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

/**
 * When automatic checks are switched on: one interval after the website's last check (so it
 * runs at about the same time of day), or after now if it's never been checked. If that's
 * already past, the next one after now. A few random minutes spread websites out.
 */
export function firstCheckAt(
  interval: Exclude<RescanInterval, 'none'>,
  lastCheckedAt: Date | null,
  now: Date,
  jitterMinutes = Math.floor(Math.random() * 20),
): Date {
  let next = addInterval(interval, lastCheckedAt ?? now);
  while (next <= now) next = addInterval(interval, next);
  return new Date(next.getTime() + jitterMinutes * 60_000);
}

const GRADES = ['A', 'B', 'C', 'D', 'F'];

/**
 * An alert is worth sending when things got worse: a lower grade, or a new critical or medium
 * problem. Small changes within a grade, new low problems and improvements stay quiet.
 */
export function shouldAlert(previousGrade: string, currentGrade: string, appearedSeverities: Severity[]): boolean {
  const worseGrade = GRADES.indexOf(currentGrade) > GRADES.indexOf(previousGrade);
  return worseGrade || appearedSeverities.some((s) => s === 'critical' || s === 'medium');
}
