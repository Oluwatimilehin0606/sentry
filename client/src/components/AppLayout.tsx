import { NavLink, Outlet } from 'react-router';
import { AccountMenu } from '@/components/AccountMenu';
import { ApiStatus } from '@/components/ApiStatus';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

/** Sections of the signed-in app. */
const NAV: { to?: string; label: string }[] = [
  { to: '/home', label: 'Home' },
  { to: '/websites', label: 'Websites' },
  { to: '/reports', label: 'Reports' },
];

/** Frame for signed-in pages: app header with navigation and account menu. */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-10">
            <NavLink
              to="/home"
              aria-label="Sentry home"
              className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Logo />
            </NavLink>
            <nav aria-label="App" className="hidden items-center gap-1.5 text-[0.9375rem] font-semibold md:flex">
              {NAV.map(({ to, label }) =>
                to ? (
                  <NavLink
                    key={label}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-lg px-3.5 py-2 transition-colors',
                        isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ) : (
                  <span
                    key={label}
                    aria-disabled="true"
                    className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-muted-foreground"
                  >
                    {label}
                    <span className="rounded-full bg-muted px-1.5 py-px text-[0.6875rem] font-bold">Soon</span>
                  </span>
                ),
              )}
            </nav>
          </div>
          <AccountMenu />
        </div>
        {/* Phones: the sections as a row of tabs under the logo, so they're always one tap away. */}
        <nav aria-label="App" className="grid grid-cols-3 gap-1 px-3 pb-2 text-[0.9375rem] font-semibold md:hidden">
          {NAV.filter((item) => item.to).map(({ to, label }) => (
            <NavLink
              key={label}
              to={to!}
              className={({ isActive }) =>
                cn(
                  'grid h-10 place-items-center rounded-[9px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* At least a screen tall: while a page is still loading its data, the footer waits below the
          fold instead of showing and then being pushed down (a layout shift). */}
      <main className="flex min-h-svh flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[0.8125rem] text-muted-foreground sm:px-6">
          <span>Sentry · Security check-ups in plain English</span>
          <span className="flex flex-wrap items-center gap-3">
            <ApiStatus />
            <NavLink to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">
              Contact
            </NavLink>
            Only check websites you own or have permission to test.
          </span>
        </div>
      </footer>
    </div>
  );
}
