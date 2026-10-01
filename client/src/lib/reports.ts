import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Grade, ScanReport } from '@/lib/scan';

/** One saved check, as listed on the Reports page. */
export type ScanSummary = {
  id: string;
  hostname: string;
  mode: 'full' | 'light';
  /** "scheduled" = an automatic check. */
  trigger: 'manual' | 'scheduled';
  score: number;
  grade: Grade;
  scannedAt: string;
  /** Compared with the same website's previous check; null for its first. */
  change: { scoreDelta: number; fixed: number; appeared: number } | null;
};

type Page = { scans: ScanSummary[]; more: boolean };

export class ReportError extends Error {}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new ReportError('We couldn’t reach the Sentry server. Check it’s running and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ReportError(body?.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

const PAGE = 20;

/** The Reports list, newest first, optionally for one website; loads older checks on demand. */
export function useScanList(hostname?: string) {
  return useInfiniteQuery({
    queryKey: ['scans', 'list', hostname ?? 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (hostname) params.set('hostname', hostname);
      if (pageParam) params.set('before', pageParam);
      return get<Page>(`/api/scans?${params}`);
    },
    getNextPageParam: (last) => (last.more ? last.scans.at(-1)?.scannedAt : undefined),
  });
}

/** The latest checks, for Home's "Latest report" and "Recent checks" and the Websites page. */
export function useRecentScans() {
  return useQuery({
    queryKey: ['scans', 'recent'],
    queryFn: () => get<Page>('/api/scans?limit=50').then((p) => p.scans),
  });
}

export function useSavedReport(id: string | undefined) {
  return useQuery({
    queryKey: ['scans', 'report', id],
    enabled: !!id,
    queryFn: () => get<{ report: ScanReport }>(`/api/scans/${id}`).then((r) => r.report),
  });
}

/** A website's checks for its score chart: up to 50, oldest first. */
export function useScoreHistory(hostname: string) {
  return useQuery({
    queryKey: ['scans', 'history', hostname],
    queryFn: () =>
      get<Page>(`/api/scans?${new URLSearchParams({ hostname, limit: '50' })}`).then((p) => [...p.scans].reverse()),
  });
}

/** "▲ 16 · 2 fixed, 1 new" for a list row; "First check" when there's nothing to compare. */
export function describeChange(change: ScanSummary['change']): string {
  if (!change) return 'First check';
  const arrow = change.scoreDelta > 0 ? `▲ ${change.scoreDelta}` : change.scoreDelta < 0 ? `▼ ${-change.scoreDelta}` : 'No change';
  const parts = [
    change.fixed ? `${change.fixed} fixed` : '',
    change.appeared ? `${change.appeared} new` : '',
  ].filter(Boolean);
  return parts.length ? `${arrow} · ${parts.join(', ')}` : arrow;
}

/** Newest check per website, newest first. */
export function latestPerWebsite(scans: ScanSummary[] | undefined): ScanSummary[] {
  const seen = new Set<string>();
  return (scans ?? []).filter((s) => !seen.has(s.hostname) && seen.add(s.hostname));
}

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Today, 14:05", "Yesterday, 09:14" or "29 Sep 2026, 09:14". */
export function whenChecked(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const label =
    date.toDateString() === now.toDateString()
      ? 'Today'
      : date.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : day.format(date);
  return `${label}, ${time.format(date)}`;
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
