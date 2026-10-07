import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Grade } from '@/lib/scan';

/** A website in the signed-in user's account, with the line that proves they own it. */
export type Domain = {
  id: string;
  hostname: string;
  verifiedAt: string | null;
  createdAt: string;
  record: { type: 'TXT'; value: string };
  /** Automatic checks (verified websites only) and whether to email when things get worse. */
  rescanInterval: RescanInterval;
  nextCheckAt: string | null;
  alertsEnabled: boolean;
  /** Whoever built the website: "Send to my developer" emails them reports. */
  developer: Developer | null;
};

export type Developer = { name: string; email: string; autoSend: boolean };

export type RescanInterval = 'none' | 'weekly' | 'monthly';

export type VerifyResult = { verified: boolean; reason?: 'not_found' | 'no_domain' | 'dns_error'; domain: Domain };

export class DomainError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  } catch {
    throw new DomainError('We couldn’t reach the Sentry server. Check it’s running and try again.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body?.error) throw new DomainError(body.error);
    if (res.status === 401) throw new DomainError('Your session has ended. Please sign in again.');
    throw new DomainError('Something went wrong. Please try again.');
  }
  return body as T;
}

const KEY = ['domains'] as const;

export function useDomains() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => call<{ domains: Domain[] }>('/api/domains').then((r) => r.domains),
  });
}

export function useAddDomain() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      call<{ domain: Domain }>('/api/domains', { method: 'POST', body: JSON.stringify({ domain }) }).then((r) => r.domain),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveDomain() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<void>(`/api/domains/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDomain() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...settings }: { id: string; rescanInterval?: RescanInterval; alertsEnabled?: boolean }) =>
      call<{ domain: Domain }>(`/api/domains/${id}`, { method: 'PATCH', body: JSON.stringify(settings) }).then(
        (r) => r.domain,
      ),
    // Show the choice straight away (radio buttons and tick boxes shouldn't wait for the server),
    // then use the server's answer, which includes the new "next check" time; undo on failure.
    onMutate: async ({ id, ...settings }) => {
      await client.cancelQueries({ queryKey: KEY });
      const before = client.getQueryData<Domain[]>(KEY);
      client.setQueryData<Domain[]>(KEY, (list) => list?.map((d) => (d.id === id ? { ...d, ...settings } : d)));
      return { before };
    },
    onError: (_err, _vars, context) => {
      if (context?.before) client.setQueryData(KEY, context.before);
    },
    onSuccess: (domain) => {
      client.setQueryData<Domain[]>(KEY, (list) => list?.map((d) => (d.id === domain.id ? domain : d)));
    },
  });
}

const nextDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Checked every week · next Wed 8 Oct", or null when automatic checks are off. */
export function scheduleLine(domain: Domain): string | null {
  if (domain.rescanInterval === 'none' || !domain.nextCheckAt) return null;
  const every = domain.rescanInterval === 'weekly' ? 'week' : 'month';
  return `Checked every ${every} · next ${nextDay.format(new Date(domain.nextCheckAt))}`;
}

/** What "Run it now" found: the automatic check, run straight away. */
export type RunNowResult = {
  outcome: 'checked' | 'alerted';
  scanId: string;
  previous: { grade: Grade; score: number } | null;
  current: { grade: Grade; score: number };
  /** Where the alert email went, when one was sent. */
  emailedTo: string | null;
  /** Where the report went, when it was also sent to the website's developer. */
  developerEmailed: string | null;
};

export function useRunNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      call<{ result: RunNowResult; domain: Domain }>(`/api/domains/${id}/run-now`, { method: 'POST' }),
    onSuccess: ({ domain }) => {
      client.setQueryData<Domain[]>(KEY, (list) => list?.map((d) => (d.id === domain.id ? domain : d)));
      // The new check shows in the chart and the lists.
      void client.invalidateQueries({ queryKey: ['scans'] });
    },
    // A failed run still moved the next check on.
    onError: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F'];
const withArticle = (grade: Grade) => (grade === 'A' || grade === 'F' ? `an ${grade}` : `a ${grade}`);

/** The sentences under "Run it now": did it get worse, and was the email sent? */
export function runNowSummary(hostname: string, r: RunNowResult): { worse: boolean; text: string; email?: string } {
  const { previous, current } = r;
  const dropped = !!previous && GRADE_ORDER.indexOf(current.grade) > GRADE_ORDER.indexOf(previous.grade);
  const worse = dropped || r.outcome === 'alerted';
  const sentTo = [r.emailedTo && `Alert email sent to ${r.emailedTo}.`, r.developerEmailed && `Report sent to your developer (${r.developerEmailed}).`];
  const email = sentTo.some(Boolean) ? { email: sentTo.filter(Boolean).join(' ') } : {};
  if (dropped) {
    return { worse, text: `${hostname} dropped from ${withArticle(previous!.grade)} to ${withArticle(current.grade)}.`, ...email };
  }
  if (worse) return { worse, text: `${hostname} has a new problem to fix.`, ...email };
  if (previous && GRADE_ORDER.indexOf(current.grade) < GRADE_ORDER.indexOf(previous.grade)) {
    return { worse, text: `Checked just now: up from ${withArticle(previous.grade)} to ${withArticle(current.grade)} (${current.score}).` };
  }
  return {
    worse,
    text: previous
      ? `Checked just now: still ${withArticle(current.grade)} (${current.score}). No email needed.`
      : `Checked just now: ${withArticle(current.grade)} (${current.score}).`,
  };
}

export function useVerifyDomain() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<VerifyResult>(`/api/domains/${id}/verify`, { method: 'POST' }),
    onSuccess: (result) => {
      if (result.verified) void client.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** Mirrors the server: a verified domain covers itself and its subdomains. */
export function isCoveredBy(domains: Domain[] | undefined, hostname: string): boolean {
  return (domains ?? []).some(
    (d) => d.verifiedAt && (hostname === d.hostname || hostname.endsWith(`.${d.hostname}`)),
  );
}

/**
 * What to type in the DNS "Name" box: "@" for the domain itself, otherwise the part before it.
 * We don't know where the registered domain starts (yourbakery.com vs yourbakery.com.ng), so
 * the full hostname is always shown too.
 */
export function recordName(hostname: string): string {
  const parts = hostname.split('.');
  // Two-part names (example.com) and common two-level endings (.com.ng, .co.uk) are the domain itself.
  const secondLevel = /^(com|co|org|net|gov|edu|ac|sch|name|mil)$/;
  const apexLength = parts.length >= 3 && secondLevel.test(parts.at(-2)!) ? 3 : 2;
  return parts.length <= apexLength ? '@' : parts.slice(0, parts.length - apexLength).join('.');
}

/** "Your developer" on the website's page: save or change who gets the reports. */
export function useSaveDeveloper() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...developer }: Developer & { id: string }) =>
      call<{ domain: Domain }>(`/api/domains/${id}/developer`, { method: 'PUT', body: JSON.stringify(developer) }).then(
        (r) => r.domain,
      ),
    onSuccess: (domain) => client.setQueryData<Domain[]>(KEY, (list) => list?.map((d) => (d.id === domain.id ? domain : d))),
  });
}

export function useRemoveDeveloper() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      call<{ domain: Domain }>(`/api/domains/${id}/developer`, { method: 'DELETE' }).then((r) => r.domain),
    onSuccess: (domain) => client.setQueryData<Domain[]>(KEY, (list) => list?.map((d) => (d.id === domain.id ? domain : d))),
  });
}

/** "Send to my developer" on a report: a new developer is remembered for the website. */
export function useSendToDeveloper(reportId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { developer?: { name: string; email: string }; note?: string; autoSend?: boolean; copyToMe: boolean }) =>
      call<{ sentTo: { name: string; email: string }; at: string }>(`/api/scans/${reportId}/send`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: KEY });
      void client.invalidateQueries({ queryKey: ['scans', 'report', reportId] });
    },
  });
}
