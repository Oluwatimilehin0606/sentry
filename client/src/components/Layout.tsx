import { Link, Outlet } from 'react-router';
import { ApiStatus } from '@/components/ApiStatus';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/components/UserMenu';

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
        <Link to="/" aria-label="Sentry home" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
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

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t py-5 text-[0.8125rem] text-subtle-foreground">
        <span>Sentry prototype · AI Foundry (QAF 2.0)</span>
        <span>Only check websites you own or have permission to test.</span>
      </footer>
    </div>
  );
}
