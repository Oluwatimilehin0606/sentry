import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';

/** "Your data" on the Account page: download a copy of everything Sentry keeps about the account. */
export function YourData() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/me/export').catch(() => null);
      if (!res) throw new Error('We couldn’t reach the Sentry server. Please try again.');
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'We couldn’t make your file. Please try again.');
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'sentry-my-data.json';
      const url = URL.createObjectURL(await res.blob());
      const link = Object.assign(document.createElement('a'), { href: url, download: name });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="data-h" className="flex flex-col gap-4">
      <h2 id="data-h" className="font-display text-xl font-bold tracking-tight">
        Your data
      </h2>
      <div className="flex flex-col gap-3 rounded-lg border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex flex-col">
            <span className="font-semibold">Download my data</span>
            <span className="text-sm text-muted-foreground">
              One file with your account details, websites and every check result.
            </span>
          </div>
          <Button variant="outline" className="h-10.5" onClick={download} disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {busy ? 'Preparing…' : 'Download (.json)'}
          </Button>
        </div>
        <FormError message={error} />
      </div>
    </section>
  );
}
