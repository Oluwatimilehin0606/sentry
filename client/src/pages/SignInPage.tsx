import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AuthCard, FormError } from '@/components/AuthCard';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authErrorMessage, safeNextPath } from '@/lib/auth-errors';
import { signIn, useSession } from '@/lib/auth-client';

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
  const [formError, setFormError] = useState<string | null>(null);

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
    const { error } = await signIn.email(values);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    navigate(next, { replace: true });
  });

  return (
    <AuthCard
      title="Sign in to Sentry"
      subtitle="Welcome back. Check on your websites’ security."
      footer={
        <>
          New to Sentry?{' '}
          <Link to="/sign-up" className="font-semibold text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />

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

        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-msg"
            {...register('password')}
          />
        </FormField>

        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
