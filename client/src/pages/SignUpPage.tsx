import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordStrength } from '@/components/PasswordStrength';
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

const STEPS = ['Create your account', 'Add your website and prove it’s yours', 'Get your grade and a fix list'];

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
  const password = useWatch({ control, name: 'password' }) ?? '';

  if (session) return <Navigate to="/home" replace />;

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
    navigate('/home', { replace: true });
  });

  return (
    <AuthShell
      panel={
        <>
          <h2 className="font-display text-[2rem] leading-[1.08] font-bold tracking-tight lg:text-[2.875rem] lg:leading-[1.06]">
            Find out your website’s grade.
          </h2>
          <p className="hidden text-lg text-[#a9bbd6] lg:block">
            Free, no technical knowledge needed. You’re three steps away.
          </p>
          <ol className="mt-5 hidden flex-col gap-3.5 lg:flex">
            {STEPS.map((step, i) => (
              <li key={step} className={i === 0 ? 'flex items-center gap-3.5' : 'flex items-center gap-3.5 text-[#a9bbd6]'}>
                <span
                  className={
                    i === 0
                      ? 'grid size-[30px] shrink-0 place-items-center rounded-full bg-[#6ea2ee] text-sm font-bold text-[#0b111c] shadow-[0_0_0_5px_rgb(110_162_238/0.22)]'
                      : 'grid size-[30px] shrink-0 place-items-center rounded-full border-[1.5px] border-[#3a5378] text-sm font-bold'
                  }
                >
                  {i + 1}
                </span>
                <span className={i === 0 ? 'font-semibold' : undefined}>{step}</span>
                {i === 0 && <span className="text-[0.8125rem] text-[#6ea2ee]">You’re here</span>}
              </li>
            ))}
          </ol>
        </>
      }
      compactPanel="Step 1 of 3 · Create your account"
      switchLink={
        <>
          <span className="hidden lg:inline">Already have an account? </span>
          <Link to="/sign-in">Sign in</Link>
        </>
      }
      points={['Free', 'No card needed', 'Results in seconds']}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">Create your account</h1>
          <p className="text-muted-foreground">It takes under a minute.</p>
        </div>

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

        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-msg password-strength"
            {...register('password')}
          />
          <PasswordStrength password={password} id="password-strength" />
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

        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="group">
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting && (
            <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
