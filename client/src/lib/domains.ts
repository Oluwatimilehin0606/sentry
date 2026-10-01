import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** A website in the signed-in user's account, with the line that proves they own it. */
export type Domain = {
  id: string;
  hostname: string;
  verifiedAt: string | null;
  createdAt: string;
  record: { type: 'TXT'; value: string };
};

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
