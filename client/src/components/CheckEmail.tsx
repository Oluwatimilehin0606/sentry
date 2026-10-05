import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { FormError } from '@/components/FormError';
import { FormNotice } from '@/components/FormNotice';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/lib/auth-errors';
import { CONFIRMED_URL, sendVerificationEmail } from '@/lib/auth-client';

/** After "Create account": the confirm link is on its way. (Screen b of the security mockup.) */
export function CheckEmail({ email, onStartAgain }: { email: string; onStartAgain: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const sendAgain = async () => {
    setError(null);
    setState('sending');
    const { error } = await sendVerificationEmail({ email, callbackURL: CONFIRMED_URL });
    if (error) {
      setError(authErrorMessage(error));
      setState('idle');
      return;
    }
    setState('sent');
  };

  return (
    <div className="flex flex-col gap-5">
      <span className="grid size-13 place-items-center rounded-[14px] bg-primary-soft">
        <Mail className="size-6.5 text-primary" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[1.75rem] font-bold tracking-tight lg:text-[2.125rem]">Check your email</h1>
        <p>
          We sent a link to <strong className="font-semibold break-all">{email}</strong>. Click it to confirm it’s your
          email, and Sentry opens, signed in.
        </p>
        <p className="text-[0.9375rem] text-muted-foreground">
          The link works for 24 hours. Can’t find it? Look in your spam or promotions folder.
        </p>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        <FormError message={error} />
        {state === 'sent' && <FormNotice title="Sent again">Use the link in the newest email.</FormNotice>}
      </div>

      <div className="flex flex-col items-start gap-2.5">
        <Button variant="outline" className="h-11 px-4" onClick={sendAgain} disabled={state === 'sending'}>
          {state === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}
          {state === 'sending' ? 'Sending…' : 'Send the link again'}
        </Button>
        <p className="text-[0.9375rem] text-muted-foreground">
          Wrong email?{' '}
          <button
            type="button"
            onClick={onStartAgain}
            className="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign up again
          </button>
        </p>
      </div>
    </div>
  );
}
