import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <span className="font-display text-5xl font-bold text-subtle-foreground">404</span>
      <h1 className="font-display text-2xl font-bold tracking-tight">We couldn’t find that page</h1>
      <p className="text-muted-foreground">The link may be old or mistyped.</p>
      <Button asChild>
        <Link to="/">Go to the home page</Link>
      </Button>
    </div>
  );
}
