import { Link, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#checks', label: 'What we check' },
  { href: '/#safety', label: 'Safety' },
  { href: '/contact', label: 'Contact' },
];

/** Header and footer for pages anyone can see: the landing page, sign-in and sign-up. */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Sentry home"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 text-[0.9375rem] font-medium md:flex">
            {NAV.map((item) => (
              <Link key={item.href} to={item.href} className="link-underline pb-0.5 text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Button asChild variant="ghost">
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-display text-base font-bold text-foreground">Sentry</span>
            <span>Security check-ups in plain English</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">
              Contact
            </Link>
            <span>Only check websites you own or have permission to test.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
