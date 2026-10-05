import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { FormNotice } from '@/components/FormNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth-errors';
import { requestPasswordReset, useSession } from '@/lib/auth-client';

const Schema = z.object({ email: z.email('Enter the email you signed up with.') });

/** "Forgot password?": emails a link to choose a new one. (Screen d of the security mockup.) */
export function ForgotPasswordPage() {
  const { data: session } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema), defaultValues: { email: '' } });

  if (session) return <Navigate to="/account" replace />;

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    setSentTo(null);
    const { error } = await requestPasswordReset({ email, redirectTo: '/reset-password' });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setSentTo(email);
  });

  return (
    <AuthShell
      panel={
        <>
          <h2 className="font-display text-[2rem] leading-[1.08] font-bold tracking-tight lg:text-5xl lg:leading-[1.06]">
            Let’s get you back in.
          </h2>
          <p className="hidden text-lg text-[#a9bbd6] lg:block">
            A link to choose a new password is one email away.
          </p>
        </>
      }
      switchLink={
        <>
          <span className="hidden lg:inline">Remembered it? </span>
          <Link to="/sign-in">Sign in</Link>
        </>
      }
      points={['Only websites you own', 'Gentle checks', 'Your content stays yours']}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">Reset your password</h1>
          <p className="text-muted-foreground">
            Enter the email you signed up with. We’ll send you a link to choose a new password.
          </p>
        </div>

        <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
          <FormError message={formError} />
          {sentTo && (
            <FormNotice title="Check your email">
              If an account uses <span className="break-all">{sentTo}</span>, a reset link is on its way. It works for 1
              hour.
            </FormNotice>
          )}
        </div>

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby="email-msg"
            {...register('email')}
          />
        </FormField>

        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Link to="/sign-in" className="self-start text-[0.9375rem] font-semibold text-primary underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
