import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Clock, Loader2, MessageSquareText, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const TOPICS = [
  { value: 'report', label: 'A question about my report' },
  { value: 'account', label: 'Help with my account' },
  { value: 'security', label: 'Report a security problem' },
  { value: 'other', label: 'Something else' },
] as const;

const MAX = 2000;

const Schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.'),
  email: z.email('Enter a valid email address, so we can reply.'),
  topic: z.enum(['report', 'account', 'security', 'other']),
  message: z
    .string()
    .trim()
    .min(10, 'Write a little more (at least 10 characters).')
    .max(MAX, `Use ${MAX} characters or fewer.`),
  // Hidden from people (see below): only bots fill it in.
  website: z.string().optional(),
});
type Values = z.infer<typeof Schema>;

/** "Contact us" (approved mockup): anyone can write; messages go to Sentry's inbox. */
export function ContactPage() {
  const { data: session } = useSession();
  const [sent, setSent] = useState<{ name: string; email: string; copy: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { name: '', email: '', topic: 'report', message: '', website: '' },
  });
  const message = useWatch({ control, name: 'message' }) ?? '';
  const topic = useWatch({ control, name: 'topic' });

  // Signed in: fill in the name and email (still editable).
  useEffect(() => {
    if (!session) return;
    if (!getValues('name')) setValue('name', session.user.name);
    if (!getValues('email')) setValue('email', session.user.email);
  }, [session, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setFormError(body?.error ?? 'We couldn’t send your message. Please try again in a minute.');
      return;
    }
    setSent({ name: values.name, email: values.email, copy: !!body?.copy });
  });

  return (
    <div className="mx-auto grid w-full max-w-6xl items-start gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-4">
        <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase sm:text-[0.8125rem]">
          Contact us
        </span>
        <h1 className="font-display text-[2.25rem] leading-[1.06] font-bold tracking-tight sm:text-[2.75rem]">
          We’re here to help
        </h1>
        <p className="text-[1.0625rem] text-muted-foreground sm:text-lg">
          Questions about your grade, help with your account, or an idea for Sentry: send us a
          message and we’ll reply by email.
        </p>
        <ul className="flex flex-col gap-4 pt-2">
          <li className="flex gap-3">
            <Clock className="mt-0.5 size-5.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">We usually reply within 2 working days</strong>
              <span className="block text-[0.9375rem] text-muted-foreground">
                Monday to Friday, Lagos time.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Found a security problem in Sentry itself?</strong>
              <span className="block text-[0.9375rem] text-muted-foreground">
                Choose “Report a security problem”. Please don’t share details publicly until we’ve
                fixed it.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <MessageSquareText
              className="mt-0.5 size-5.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold">About your website’s report?</strong>
              <span className="block text-[0.9375rem] text-muted-foreground">
                Tell us the website’s address. We never need your password.
              </span>
            </span>
          </li>
        </ul>
      </div>

      {sent ? (
        <div
          role="status"
          className="flex flex-col items-start gap-3.5 rounded-2xl border bg-card p-6 sm:p-8"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-pass-soft">
            <Check className="size-6 text-pass" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <h2 className="font-display text-2xl font-bold tracking-tight">Message sent</h2>
          <p>
            Thanks, {sent.name.split(' ')[0]}. We’ll reply to{' '}
            <strong className="font-semibold break-all">{sent.email}</strong>, usually within 2
            working days.
          </p>
          {sent.copy && (
            <p className="text-[0.9375rem] text-muted-foreground">
              We’ve also emailed you a copy of your message.
            </p>
          )}
          <Link
            to={session ? '/home' : '/'}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            ← Back to Sentry
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          noValidate
          className="relative flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-8"
        >
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Your name" error={errors.name?.message}>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby="name-msg"
                {...register('name')}
              />
            </FormField>
            <FormField
              id="email"
              label="Your email"
              hint="We’ll reply here."
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby="email-msg"
                {...register('email')}
              />
            </FormField>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1.5 text-sm font-semibold">What’s it about?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOPICS.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[0.9375rem] transition-colors',
                    topic === t.value
                      ? 'border-2 border-primary bg-primary-soft'
                      : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    value={t.value}
                    className="accent-primary"
                    {...register('topic')}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="message" className="text-sm font-semibold">
              Your message
            </label>
            <textarea
              id="message"
              rows={6}
              maxLength={MAX}
              aria-invalid={!!errors.message}
              aria-describedby="message-msg"
              className="min-h-36 rounded-md border border-input bg-card px-3.5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
              {...register('message')}
            />
            <span id="message-msg" className="flex justify-between gap-3 text-[0.8125rem]">
              {errors.message ? (
                <span role="alert" className="text-critical">
                  {errors.message.message}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Include your website’s address if it’s about a report.
                </span>
              )}
              <span className="shrink-0 text-muted-foreground">
                {message.length.toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </span>
          </div>

          {/* A trap for bots: people never see or reach this field. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isSubmitting ? 'Sending…' : 'Send message'}
              {!isSubmitting && <Send aria-hidden="true" />}
            </Button>
            <span className="text-sm text-muted-foreground">
              We only use your details to reply to you.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
