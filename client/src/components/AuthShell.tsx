import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { MonitorWave } from '@/components/MonitorWave';

const PANEL_TRACE = '#6ea2ee';

type Props = {
  /** Headline, supporting line and any extra content for the brand panel. */
  panel: ReactNode;
  /** Short line shown under the panel headline on phones, where the panel is compact. */
  compactPanel?: ReactNode;
  /** "New to Sentry? Create an account" style switch link. */
  switchLink: ReactNode;
  /** Reassurance points at the bottom of the panel (desktop). */
  points: string[];
  children: ReactNode;
};

/**
 * Split-screen frame for sign-in and sign-up: a deep-blue brand panel with a live
 * heart-monitor trace on the left, and a focused form on the right. On phones the panel
 * becomes a short band above the form.
 */
export function AuthShell({ panel, compactPanel, switchLink, points, children }: Props) {
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-background lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[620px_minmax(0,1fr)]">
      <aside className="relative flex flex-col overflow-hidden bg-[#0e2342] px-4 pt-5 text-[#e6ebf3] sm:px-8 lg:px-14 lg:pt-12 lg:pb-12">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            aria-label="Sentry home"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-[#6ea2ee]/60 focus-visible:outline-none"
          >
            <Logo tone="onDark" />
          </Link>
          <div className="flex gap-1.5 text-[0.9375rem] lg:hidden [&_a]:font-semibold [&_a]:text-[#e6ebf3]">{switchLink}</div>
        </div>

        <div className="mt-6 flex max-w-[470px] flex-col gap-3 lg:mt-28 lg:gap-4">{panel}</div>
        {compactPanel && <div className="mt-2 text-[0.9375rem] text-[#a9bbd6] lg:hidden">{compactPanel}</div>}

        <MonitorWave
          className="relative -mx-4 mt-4 h-[84px] shrink-0 sm:-mx-8 lg:-mx-14 lg:mt-14 lg:h-[150px]"
          baseline={0.62}
          ampRatio={0.4}
          alpha={{ light: 0.85, dark: 0.85 }}
          color={PANEL_TRACE}
        />

        <ul className="mt-auto hidden flex-wrap gap-x-6 gap-y-2 pt-10 text-sm text-[#a9bbd6] lg:flex">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <Check className="size-4 text-[#6ea2ee]" strokeWidth={2.4} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col px-4 py-7 sm:px-10 lg:px-16 lg:py-10">
        <div className="hidden justify-end gap-1.5 text-[0.9375rem] text-muted-foreground lg:flex [&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          {switchLink}
        </div>
        <div className="flex flex-1 items-center justify-center py-2 lg:py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <p className="mt-6 text-center text-[0.8125rem] text-muted-foreground">
          Only check websites you own or have permission to test.
        </p>
      </main>
    </div>
  );
}
