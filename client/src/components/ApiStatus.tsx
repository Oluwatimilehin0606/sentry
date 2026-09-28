import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type Health = { status: 'ok' | 'degraded'; db: 'ok' | 'unreachable'; uptime: number };

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health');
  // 503 still carries a JSON body saying which part is down.
  const body = (await res.json().catch(() => null)) as Health | null;
  if (!body) throw new Error(`Health check failed: ${res.status}`);
  return body;
}

export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    retry: false,
  });

  const state = isPending ? 'pending' : isError ? 'offline' : data.db === 'ok' ? 'ok' : 'degraded';
  const label = {
    pending: 'Connecting…',
    ok: 'API connected',
    degraded: 'Database offline',
    offline: 'API offline',
  }[state];

  return (
    <span
      role="status"
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold',
        state === 'pending' && 'bg-muted text-muted-foreground',
        state === 'ok' && 'bg-pass-soft text-pass',
        state === 'degraded' && 'bg-medium-soft text-medium',
        state === 'offline' && 'bg-critical-soft text-critical',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
