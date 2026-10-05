import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordStrength } from '@/components/PasswordStrength';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/lib/auth-errors';
import { resetPassword } from '@/lib/auth-client';

const Schema = z.object({
  password: z
    .string()
    .min(12, 'Use at least 12 characters. A short phrase is easier to remember.')
    .max(128, 'Use 128 characters or fewer.'),
});

/**
 * "Choose a new password", from the reset email's link (?token=…), or ?error=INVALID_TOKEN when
 * the link had expired or was used. (Screens e and f of the security mockup.)
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [expired, setExpired] = useState(!token || params.has('error'));
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema), defaultValues: { password: '' } });
  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await resetPassword({ newPassword: password, token: token! });
    if (error?.code === 'INVALID_TOKEN') {
      setExpired(true);
      return;
    }
    if (error?.code === 'PASSWORD_LEAKED') {
      setError('password', { message: authErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    navigate('/sign-in?reset=1', { replace: true });
  });

  return (
    <AuthShell
      panel={
        <>
          <h2 className="font-display text-[2rem] leading-[1.08] font-bold tracking-tight lg:text-5xl lg:leading-[1.06]">
            Let’s get you back in.
          </h2>
          <p className="hidden text-lg text-[#a9bbd6] lg:block">
            Choose a password you don’t use anywhere else.
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
      {expired ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">This link has expired</h1>
            <p className="text-muted-foreground">
              Reset links work once, for 1 hour. Ask for a new one and use the newest email.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/forgot-password">Send a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">Choose a new password</h1>
            <p className="text-muted-foreground">At least 12 characters. A short phrase is easier to remember.</p>
          </div>

          <FormError message={formError} />

          <FormField id="password" label="New password" error={errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby="password-msg password-strength"
              {...register('password')}
            />
            <PasswordStrength password={password} id="password-strength" />
          </FormField>

          <p className="text-[0.9375rem] text-muted-foreground">
            Saving it signs you out on every other phone and computer.
          </p>

          <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
