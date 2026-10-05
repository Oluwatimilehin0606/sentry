import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { FormNotice } from '@/components/FormNotice';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authErrorMessage, safeNextPath } from '@/lib/auth-errors';
import { CONFIRMED_URL, signIn, useSession } from '@/lib/auth-client';

const SignInSchema = z.object({
  email: z.email('Enter the email you signed up with.'),
  password: z.string().min(1, 'Enter your password.'),
});

type SignInValues = z.infer<typeof SignInSchema>;

export function SignInPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  // Arriving from an email's link that had expired or was already used (see CONFIRMED_URL).
  const linkFailed = params.has('error');
  const [formError, setFormError] = useState<string | null>(
    linkFailed ? 'That confirm link has expired or was already used. Sign in and we’ll send you a new one.' : null,
  );
  // Arriving from "Choose a new password".
  const passwordReset = params.get('reset') === '1' && !formError;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  });

  if (session) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Not confirmed yet: Better Auth sends a fresh link, which lands back here.
    const { error } = await signIn.email({ ...values, callbackURL: CONFIRMED_URL });
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      setFormError(`Please confirm your email first. We’ve sent a new link to ${values.email}.`);
      return;
    }
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    navigate(next, { replace: true });
  });

  return (
    <AuthShell
      panel={
        <>
          <h2 className="font-display text-[2rem] leading-[1.08] font-bold tracking-tight lg:text-5xl lg:leading-[1.06]">
            Welcome back.
          </h2>
          <p className="hidden text-lg text-[#a9bbd6] lg:block">
            Pick up where you left off: your websites’ security, explained in plain English.
          </p>
        </>
      }
      switchLink={
        <>
          <span className="hidden lg:inline">New to Sentry? </span>
          <Link to="/sign-up">Create an account</Link>
        </>
      }
      points={['Only websites you own', 'Gentle checks', 'Your content stays yours']}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">Sign in</h1>
          <p className="text-muted-foreground">Use the email you signed up with.</p>
        </div>

        <FormError message={formError} />
        {passwordReset && (
          <FormNotice title="Password changed">
            Every other phone and computer has been signed out. Sign in with your new password.
          </FormNotice>
        )}

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

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAside={
            <Link to="/forgot-password" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-msg"
            {...register('password')}
          />
        </FormField>

        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="group">
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting && (
            <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
