import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type Health = { status: 'ok'; uptime: number };

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export function ApiStatus() {
  const { isSuccess, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    retry: false,
  });

  const label = isPending ? 'Connecting…' : isSuccess ? 'API connected' : 'API offline';

  return (
    <span
      role="status"
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold',
        isPending && 'bg-muted text-muted-foreground',
        isSuccess && 'bg-pass-soft text-pass',
        !isPending && !isSuccess && 'bg-critical-soft text-critical',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
