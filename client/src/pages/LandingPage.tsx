import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  EyeOff,
  FileWarning,
  Globe,
  LockKeyhole,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ExampleReport } from '@/components/landing/ExampleReport';
import { PulseLine } from '@/components/landing/PulseLine';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useScrollReveal } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ---------- Small building blocks ---------- */

function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase sm:text-[0.8125rem]">{children}</span>;
}

/** Stagger delay for the nth item in a revealed group. */
const delay = (i: number, stepMs = 90): CSSProperties => ({ '--delay': `${i * stepMs}ms` }) as CSSProperties;

function SectionHeading({ eyebrow, title, id, children }: { eyebrow: string; title: string; id: string; children?: ReactNode }) {
  return (
    <div data-reveal className="reveal flex max-w-3xl flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="font-display text-[2rem] leading-[1.12] font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">
        {title}
      </h2>
      {children && <p className="text-base text-muted-foreground sm:text-lg">{children}</p>}
    </div>
  );
}

/** Lifts slightly on hover. Kept on an inner element so it doesn't fight the reveal transition. */
const hoverLift =
  'transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(17_26_43/0.05),0_10px_24px_rgb(17_26_43/0.08)]';

/* ---------- Content ---------- */

const PROMISES = ['Free', 'No technical knowledge needed', 'Results in seconds'];

const STEPS = [
  { title: 'Create a free account', body: 'It takes under a minute. All you need is an email address.' },
  {
    title: 'Add your website and prove it’s yours',
    body: 'Copy one short line into your domain’s settings. We show you exactly what to paste and where.',
  },
  {
    title: 'Get your grade and a fix list',
    body: 'See your score out of 100, what each problem means for your business, and what to fix first.',
  },
];
const STEP_MS = 450;

const CHECKS: { Icon: LucideIcon; title: string; body: string; comingNext?: boolean }[] = [
  {
    Icon: LockKeyhole,
    title: 'Secure connection',
    body: 'Is your site served over HTTPS with a valid, up-to-date certificate, so visitors’ details can’t be read on the way?',
  },
  {
    Icon: ShieldCheck,
    title: 'Browser protections',
    body: 'Does your site switch on the security settings browsers offer, like stopping fake copies of your pages inside other sites?',
  },
  {
    Icon: FileWarning,
    title: 'Exposed private files',
    body: 'Can anyone download files that should stay private, like password settings or database backups?',
    comingNext: true,
  },
];

const SAFETY: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: Globe,
    title: 'Only websites you own',
    body: 'You prove a website is yours before Sentry checks it, so nobody can use Sentry against someone else’s site.',
  },
  {
    Icon: Activity,
    title: 'Gentle checks',
    body: 'Sentry looks at your site the way a normal visitor’s browser does. It never tries to break in or slow your site down.',
  },
  {
    Icon: EyeOff,
    title: 'Your content stays yours',
    body: 'Sentry reads your site’s security settings only. It never downloads or stores your pages or your customers’ data.',
  },
];

/* ---------- Sections ---------- */

function Hero() {
  return (
    <section aria-labelledby="hero-h">
      <Container className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-6 sm:gap-7">
          <Eyebrow>Free security check-up for small businesses</Eyebrow>
          <h1
            id="hero-h"
            className="font-display text-[2.5rem] leading-[1.06] font-bold tracking-[-0.02em] sm:text-[3.5rem] lg:text-[4rem] lg:leading-[1.04] lg:tracking-[-0.025em]"
          >
            Is your business website leaving the door open?
          </h1>
          <p className="max-w-[34em] text-[1.0625rem] text-muted-foreground sm:text-xl">
            Sentry checks your website’s security and explains what it finds in plain English: one grade, what each
            problem means for your business, and what to fix first.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <Button asChild size="lg" className="group h-13 px-6.5 text-[1.0625rem]">
              <Link to="/sign-up">
                Get started
                <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-13 px-6 text-[1.0625rem]">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
          <ul aria-label="What you get" className="flex flex-col gap-2 text-[0.9375rem] text-muted-foreground sm:flex-row sm:gap-6">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Check className="size-4 text-pass" strokeWidth={2.4} aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <ExampleReport />
      </Container>
    </section>
  );
}

function PlainEnglish() {
  return (
    <section aria-labelledby="plain-h" className="border-y bg-card">
      <Container className="flex flex-col gap-8 py-16 sm:gap-12 sm:py-26">
        <SectionHeading eyebrow="Why Sentry" title="Plain English, not jargon" id="plain-h">
          Most security scanners are built for experts. Sentry explains the same problem the way a knowledgeable friend
          would, and tells you exactly what to do about it.
        </SectionHeading>

        {/* Before → after: the jargon appears, the arrow pops, then Sentry's version slides in. */}
        <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
          <div data-reveal className="reveal flex h-full flex-col gap-4 rounded-[14px] border bg-background p-5 sm:p-7">
            <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase sm:text-[0.8125rem]">
              What a typical scanner says
            </span>
            <div className="flex flex-1 flex-col gap-2 rounded-[10px] bg-muted p-4 font-mono text-[0.8125rem] leading-relaxed [overflow-wrap:anywhere] text-muted-foreground sm:gap-2.5 sm:p-5 sm:text-sm">
              <span>
                <span className="font-medium text-medium">[MEDIUM]</span> HSTS header not set
              </span>
              <span>CWE-319: Cleartext Transmission of Sensitive Information</span>
              <span>Response missing Strict-Transport-Security (RFC 6797)</span>
              <span className="hidden sm:inline">CVSS 3.1: AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N</span>
            </div>
            <p className="text-sm text-muted-foreground sm:text-[0.9375rem]">
              Accurate, but it doesn’t tell a business owner whether to worry or what to do.
            </p>
          </div>

          <div
            data-reveal
            style={{ '--delay': '350ms' } as CSSProperties}
            className="reveal reveal-pop mx-auto grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
            aria-hidden="true"
          >
            <ArrowDown className="size-5 lg:hidden" />
            <ArrowRight className="hidden size-5 lg:block" />
          </div>

          <div
            data-reveal
            style={{ '--delay': '600ms' } as CSSProperties}
            className="reveal reveal-from-right flex h-full flex-col gap-4 rounded-[14px] border-2 border-primary bg-card p-5 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_12px_32px_rgb(17_26_43/0.08)] sm:p-7"
          >
            <span className="text-xs font-semibold tracking-[0.06em] text-primary uppercase sm:text-[0.8125rem]">
              What Sentry says
            </span>
            <h3 className="text-lg leading-snug font-semibold sm:text-xl">
              Browsers aren’t told to always use a secure connection
            </h3>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Why it matters</span>
              <span className="text-[0.9375rem] sm:text-base">
                Without it, an attacker on public Wi-Fi can quietly downgrade a visitor to the insecure version of your
                site before they’re moved to the secure one.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">How to fix</span>
              <span className="text-[0.9375rem] sm:text-base">
                Turn on HSTS in your host’s or Cloudflare’s SSL settings, or add one line to your server:
              </span>
              <code className="self-start rounded-md bg-muted px-2.5 py-1.5 font-mono text-[0.8125rem] [overflow-wrap:anywhere] sm:text-sm">
                Strict-Transport-Security: max-age=31536000
              </code>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-4">
      <Container className="flex flex-col gap-8 py-16 sm:gap-12 sm:py-26">
        <SectionHeading eyebrow="How it works" title="From sign-up to your grade in three steps" id="how-h" />
        {/* Numbers light up 1 → 2 → 3 while a line draws between them (down on phones, across on desktop). */}
        <ol data-reveal className="steps grid gap-3.5 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 lg:grid-cols-1 lg:grid-rows-[40px_1fr] lg:gap-5"
            >
              <span
                aria-hidden="true"
                style={delay(i, STEP_MS)}
                className="step-num relative z-10 grid size-10 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground"
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-10 left-[19px] h-[calc(100%-40px+14px)] w-0.5 overflow-hidden rounded-full bg-border lg:top-[19px] lg:left-10 lg:h-0.5 lg:w-[calc(100%-40px+24px)]"
                >
                  <span style={{ '--delay': `${i * STEP_MS + 120}ms` } as CSSProperties} className="step-bar block size-full bg-primary" />
                </span>
              )}
              <div className={cn('flex flex-col gap-1.5 rounded-[14px] border bg-card p-5 sm:p-7 lg:h-full lg:gap-3', hoverLift)}>
                <h3 className="text-lg font-semibold sm:text-xl">{step.title}</h3>
                <p className="text-[0.9375rem] text-muted-foreground sm:text-base">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function WhatWeCheck() {
  return (
    <section id="checks" aria-labelledby="checks-h" className="scroll-mt-4 border-y bg-card">
      <Container className="flex flex-col gap-8 py-16 sm:gap-12 sm:py-26">
        <SectionHeading eyebrow="What we check" title="The gaps attackers look for first" id="checks-h" />
        <div className="grid gap-3.5 sm:gap-6 lg:grid-cols-3">
          {CHECKS.map(({ Icon, title, body, comingNext }, i) => (
            <div key={title} data-reveal style={delay(i)} className="reveal">
              <article className={cn('flex h-full flex-col gap-3 rounded-[14px] border bg-background p-5 sm:gap-3.5 sm:p-7', hoverLift)}>
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-[10px] bg-primary-soft text-primary sm:size-11">
                    <Icon className="size-5 sm:size-5.5" aria-hidden="true" />
                  </span>
                  {comingNext && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[0.8125rem] font-semibold text-muted-foreground">
                      Coming next
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold sm:text-xl">{title}</h3>
                <p className="text-[0.9375rem] text-muted-foreground sm:text-base">{body}</p>
              </article>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-h" className="scroll-mt-4">
      <Container className="grid gap-8 py-16 sm:py-24 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-18">
        <div data-reveal className="reveal flex flex-col gap-3">
          <Eyebrow>Safety</Eyebrow>
          <h2 id="safety-h" className="font-display text-[2rem] leading-[1.12] font-bold tracking-tight sm:text-[2.5rem]">
            Built to be safe for your website
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {SAFETY.map(({ Icon, title, body }, i) => (
            <div key={title} data-reveal style={delay(i, 110)} className="reveal flex gap-3.5 sm:flex-col sm:gap-2.5">
              <Icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1 sm:gap-2.5">
                <h3 className="text-[1.0625rem] font-semibold sm:text-lg">{title}</h3>
                <p className="text-[0.9375rem] text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-h">
      <Container className="pb-14 sm:pb-24">
        <div
          data-reveal
          className="reveal flex flex-col gap-5 rounded-[18px] bg-band px-6 py-9 text-on-band sm:rounded-[20px] sm:px-16 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-12"
        >
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="cta-h" className="font-display text-[1.875rem] leading-[1.12] font-bold sm:text-[2.75rem] sm:leading-[1.1] sm:tracking-tight">
              Find out your website’s grade
            </h2>
            <p className="text-base text-on-band-muted sm:text-lg">
              Free, no technical knowledge needed, and your first results arrive in seconds.
            </p>
          </div>
          <Link
            to="/sign-up"
            className="group inline-flex h-13 shrink-0 items-center justify-center gap-2.5 rounded-[10px] bg-on-band px-7.5 text-[1.0625rem] font-semibold text-band transition-[opacity,translate] duration-200 hover:-translate-y-0.5 hover:opacity-95 focus-visible:ring-[3px] focus-visible:ring-on-band/50 focus-visible:outline-none sm:h-14 sm:text-lg"
          >
            Get started
            <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* ---------- Page ---------- */

export function LandingPage() {
  const { data: session, isPending } = useSession();
  const { hash, state } = useLocation();
  // Set by "Sign out": stay here while the session is being ended instead of bouncing to /home.
  const signingOut = (state as { signedOut?: boolean } | null)?.signedOut === true;
  const showLanding = !(!isPending && session && !signingOut);
  const pageRef = useRef<HTMLDivElement>(null);

  useScrollReveal([showLanding]);

  // Links like /#how from other pages: scroll to the section once it exists.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  if (!showLanding) return <Navigate to="/home" replace />;

  return (
    // Sections must stay direct children: the heartbeat line places its beats at their boundaries.
    <div ref={pageRef} className="relative overflow-x-clip">
      <PulseLine containerRef={pageRef} />
      <Hero />
      <PlainEnglish />
      <HowItWorks />
      <WhatWeCheck />
      <Safety />
      <FinalCta />
    </div>
  );
}
