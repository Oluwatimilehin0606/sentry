import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/lib/auth-errors';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Delete account": everything goes at once, after typing the password. Not on the demo account. */
export function DeleteAccount({ counts }: { counts: { websites: number; reports: number } }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setError('Type your password to confirm.');
      return;
    }
    setError(null);
    setBusy(true);
    // A plain request rather than the auth client's deleteUser: that one ends the page's session at
    // once, and this signed-in page would send us to sign-in before the landing page can say it's done.
    const res = await fetch('/api/auth/delete-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    const error = res?.ok ? null : ((await res?.json().catch(() => null)) ?? { status: res?.status });
    setBusy(false);
    if (!res) {
      setError('We couldn’t reach the Sentry server. Please try again.');
      return;
    }
    if (error?.code === 'INVALID_PASSWORD') {
      setError('That isn’t your password.');
      return;
    }
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    client.clear();
    // signedOut: the landing page stays put while the ended session clears (see LandingPage).
    // The landing page then tells the rest of the website the session has ended (see LandingPage).
    navigate('/', { replace: true, state: { signedOut: true, accountDeleted: true } });
  };

  return (
    <section aria-labelledby="delete-h" className="flex flex-col gap-4">
      <h2 id="delete-h" className="font-display text-xl font-bold tracking-tight">
        Delete account
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex max-w-[60ch] flex-col">
            <span className="font-semibold">Delete my account and all its data</span>
            <span className="text-sm text-muted-foreground">
              Your account, websites, reports and automatic checks are deleted straight away. This can’t be undone.
            </span>
          </div>
          {!open && (
            <Button
              variant="outline"
              className="h-10.5 border-critical/40 text-critical hover:bg-critical-soft hover:text-critical"
              onClick={() => setOpen(true)}
            >
              Delete account…
            </Button>
          )}
        </div>

        {open && (
          <form
            onSubmit={confirm}
            noValidate
            className="flex max-w-md flex-col gap-3.5 rounded-[10px] border border-critical/40 p-4 sm:p-5"
          >
            <h3 className="font-display text-lg font-bold">Delete your account?</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.9375rem]">
              <li>{plural(counts.websites, 'website', 'websites')} and their ownership proofs</li>
              <li>{plural(counts.reports, 'report', 'reports')} and their history</li>
              <li>Automatic checks and email alerts stop</li>
            </ul>
            <p className="text-[0.9375rem]">Download your data first if you want a copy.</p>
            <FormField id="delete-password" label="Type your password to confirm" error={error ?? undefined}>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby="delete-password-msg"
              />
            </FormField>
            <div className="flex flex-wrap gap-2.5">
              <Button type="submit" variant="destructive" disabled={busy} aria-busy={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {busy ? 'Deleting…' : 'Delete everything'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setPassword('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
