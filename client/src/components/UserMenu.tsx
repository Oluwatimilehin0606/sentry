import { LogOut, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';

export function UserMenu() {
  const { data, isPending } = useSession();
  const navigate = useNavigate();

  if (isPending) return <span className="h-8 w-28 animate-pulse rounded-md bg-muted" aria-hidden="true" />;

  if (!data) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/sign-in">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/sign-up">Create account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link to="/account">
          <UserRound aria-hidden="true" />
          <span className="max-w-[12ch] truncate">{data.user.name.split(' ')[0]}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          // Leave the protected page first; otherwise it sees the session end and sends us to sign-in.
          navigate('/', { replace: true, state: { signedOut: true } });
          await signOut();
        }}
      >
        <LogOut aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
