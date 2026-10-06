import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { FormNotice } from '@/components/FormNotice';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordStrength } from '@/components/PasswordStrength';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/lib/auth-errors';
import { changePassword, revokeOtherSessions } from '@/lib/auth-client';
import { describeDevice, isMobileDevice } from '@/lib/devices';

type Device = { id: string; userAgent: string | null; createdAt: string; current: boolean };

const signedInAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "Sign-in and security" on the Account page: change password, and where the account is signed in. */
export function SignInSecurity() {
  return (
    <section aria-labelledby="security-h" className="flex flex-col gap-4">
      <h2 id="security-h" className="font-display text-xl font-bold tracking-tight">
        Sign-in and security
      </h2>
      <div className="flex flex-col rounded-lg border bg-card [&>*+*]:border-t">
        <PasswordRow />
        <Devices />
      </div>
    </section>
  );
}

const ChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(12, 'Use at least 12 characters. A short phrase is easier to remember.')
    .max(128, 'Use 128 characters or fewer.'),
});

function PasswordRow() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof ChangeSchema>>({
    resolver: zodResolver(ChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await changePassword({ ...values, revokeOtherSessions: true });
    if (error?.code === 'INVALID_PASSWORD') {
      setError('currentPassword', { message: 'That isn’t your current password.' }, { shouldFocus: true });
      return;
    }
    if (error?.code === 'PASSWORD_LEAKED') {
      setError('newPassword', { message: authErrorMessage(error) }, { shouldFocus: true });
      return;
    }
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    reset();
    setOpen(false);
    setDone(true);
    void client.invalidateQueries({ queryKey: ['sessions'] });
  });

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-col">
          <span className="font-semibold">Password</span>
          <span className="text-sm text-muted-foreground">At least 12 characters. Use one you don’t use anywhere else.</span>
        </div>
        {!open && (
          <Button variant="outline" className="h-10.5" onClick={() => { setDone(false); setOpen(true); }}>
            Change password
          </Button>
        )}
      </div>

      {done && (
        <FormNotice title="Password changed">Every other phone and computer has been signed out.</FormNotice>
      )}

      {open && (
        <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
          <FormError message={formError} />
          <FormField id="current-password" label="Current password" error={errors.currentPassword?.message}>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              aria-describedby="current-password-msg"
              {...register('currentPassword')}
            />
          </FormField>
          <FormField id="new-password" label="New password" error={errors.newPassword?.message}>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              aria-describedby="new-password-msg new-password-strength"
              {...register('newPassword')}
            />
            <PasswordStrength password={newPassword} id="new-password-strength" />
          </FormField>
          <p className="text-sm text-muted-foreground">Saving signs you out everywhere else.</p>
          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Saving…' : 'Save password'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { reset(); setFormError(null); setOpen(false); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Devices() {
  const client = useQueryClient();
  const devices = useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<Device[]> => {
      const res = await fetch('/api/me/sessions');
      if (!res.ok) throw new Error('We couldn’t load where you’re signed in.');
      return (await res.json()).sessions;
    },
  });
  const signOutOne = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
      if (!res) throw new Error('We couldn’t reach the Sentry server. Please try again.');
      if (!res.ok && res.status !== 404) throw new Error((await res.json().catch(() => null))?.error ?? 'We couldn’t sign that device out.');
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const signOutOthers = useMutation({
    mutationFn: async () => {
      const { error } = await revokeOtherSessions();
      if (error) throw new Error(authErrorMessage(error));
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const list = devices.data ?? [];
  const others = list.filter((d) => !d.current).length;

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-col">
          <span className="font-semibold">Where you’re signed in</span>
          <span className="text-sm text-muted-foreground">
            If you don’t recognise one, sign it out and change your password.
          </span>
        </div>
        <Button
          variant="outline"
          className="h-10.5"
          disabled={others === 0 || signOutOthers.isPending}
          onClick={() => signOutOthers.mutate()}
        >
          {signOutOthers.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Sign out everywhere else
        </Button>
      </div>

      <FormError message={(signOutOne.error ?? signOutOthers.error ?? devices.error)?.message ?? null} />

      <ul aria-busy={devices.isPending} className="flex flex-col rounded-md border [&>li+li]:border-t">
        {devices.isPending && (
          <li className="px-4 py-3">
            {/* As tall as a real device row (name and sign-in time), so nothing jumps when they load. */}
            <span className="block h-11 w-56 animate-pulse rounded bg-muted" />
          </li>
        )}
        {list.map((d) => {
          const Icon = isMobileDevice(d.userAgent) ? Smartphone : Monitor;
          return (
            <li key={d.id} className="flex items-center gap-3.5 px-4 py-3">
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  {describeDevice(d.userAgent)}
                  {d.current && (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">This device</span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">Signed in {signedInAt(d.createdAt)}</span>
              </span>
              {!d.current && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={signOutOne.isPending && signOutOne.variables === d.id}
                  onClick={() => signOutOne.mutate(d.id)}
                  aria-label={`Sign out ${describeDevice(d.userAgent)}, signed in ${signedInAt(d.createdAt)}`}
                >
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
