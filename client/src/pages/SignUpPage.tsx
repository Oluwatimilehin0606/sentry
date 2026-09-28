import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthCard, FormError } from '@/components/AuthCard';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth-errors';
import { signUp, useSession } from '@/lib/auth-client';

const SignUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.'),
  email: z.email('Enter a valid email address, like you@yourbakery.com.'),
  password: z
    .string()
    .min(12, 'Use at least 12 characters. A short phrase is easier to remember.')
    .max(128, 'Use 128 characters or fewer.'),
  acceptTerms: z.literal(true, 'Tick this box to create your account.'),
});

type SignUpValues = z.input<typeof SignUpSchema>;

export function SignUpPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false as unknown as true },
  });

  if (session) return <Navigate to="/account" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await signUp.email({
      name: values.name.trim(),
      email: values.email,
      password: values.password,
      // Checked again on the server: sign-up is refused without it.
      acceptTerms: values.acceptTerms,
    } as Parameters<typeof signUp.email>[0]);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    navigate('/account', { replace: true });
  });

  return (
    <AuthCard
      title="Create your Sentry account"
      subtitle="Save your websites and see how their security changes over time."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />

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
          label="Email"
          hint="We’ll send score alerts here."
          error={errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourbakery.com"
            aria-invalid={!!errors.email}
            aria-describedby="email-msg"
            {...register('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          hint="At least 12 characters."
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-msg"
            {...register('password')}
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  aria-invalid={!!errors.acceptTerms}
                  aria-describedby="acceptTerms-msg"
                  className="mt-0.5"
                />
              )}
            />
            <label htmlFor="acceptTerms" className="text-[0.9375rem] leading-snug">
              I will only scan websites I own or have written permission to test.
            </label>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-msg" role="alert" className="pl-7 text-[0.8125rem] text-critical">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
