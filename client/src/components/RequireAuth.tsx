import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/lib/auth-client';

/** Sends signed-out visitors to sign-in, then back to where they were going. */
export function RequireAuth() {
  const { data, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }

  if (!data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  return <Outlet />;
}
