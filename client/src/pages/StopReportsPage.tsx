import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } }).catch(
    () => null,
  );
  const body = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(body?.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

/**
 * The developer's "Don't send me reports" link from a "Send to my developer" email. It asks
 * before stopping, so email security scanners that open links can't stop reports by accident.
 */
export function StopReportsPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const info = useQuery({
    queryKey: ['stop-reports', token],
    enabled: !!token,
    retry: false,
    queryFn: () =>
      call<{ hostname: string; ownerName: string }>(
        `/api/developer/stop?token=${encodeURIComponent(token)}`,
      ),
  });
  const stop = useMutation({
    mutationFn: () =>
      call<{ hostname: string }>('/api/developer/stop', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-16 sm:px-6">
      {stop.isSuccess ? (
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6 sm:p-8"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-pass-soft">
            <Check className="size-6 text-pass" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Reports stopped</h1>
          <p>You won’t get Sentry reports for {stop.data.hostname} any more.</p>
        </div>
      ) : info.isPending && token ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : info.isError || !token ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            This link doesn’t work any more
          </h1>
          <p className="text-muted-foreground">
            {info.error?.message ??
              'It has already been used, or the owner has changed who gets the reports.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Stop reports for {info.data!.hostname}?
          </h1>
          <p>
            {info.data!.ownerName} asked Sentry to send you this website’s security reports. If you
            stop them, Sentry won’t email you about {info.data!.hostname} again.
          </p>
          <FormError message={stop.error?.message ?? null} />
          <Button onClick={() => stop.mutate()} disabled={stop.isPending}>
            {stop.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Stop the reports
          </Button>
        </div>
      )}
    </div>
  );
}
