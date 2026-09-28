import { Link, Outlet } from 'react-router';
import { ApiStatus } from '@/components/ApiStatus';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/components/UserMenu';

/** Header and footer for signed-in pages (home, account). */
export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
        <Link
          to="/home"
          aria-label="Sentry home"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <ApiStatus />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t py-5 text-[0.8125rem] text-muted-foreground">
        <span>Sentry · Security check-ups in plain English</span>
        <span>Only check websites you own or have permission to test.</span>
      </footer>
    </div>
  );
}
