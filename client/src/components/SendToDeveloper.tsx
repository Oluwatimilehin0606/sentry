import { Loader2, Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSendToDeveloper, type Domain } from '@/lib/domains';
import type { ScanReport } from '@/lib/scan';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The note the owner starts from; the server writes the same one for automatic sends. */
function defaultNote(developer: string, hostname: string, problems: number): string {
  const hi = firstName(developer) ? `Hi ${firstName(developer)},` : 'Hi,';
  return problems === 0
    ? `${hi} Sentry checked ${hostname} and found no problems. The report is attached for your records.`
    : `${hi} Sentry found ${plural(problems, 'security problem', 'security problems')} on ${hostname}. Could you fix ${problems === 1 ? 'it' : 'them, starting with the first one'}? The full report is attached.`;
}

const sentAt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * "Send to my developer" on a report (approved mockup): the button, the "Sent to …" line, and the
 * box that asks who built the website the first time, then remembers them for that website.
 */
export function SendToDeveloper({
  report,
  site,
}: {
  report: ScanReport & { id: string };
  site: Domain | undefined;
}) {
  const send = useSendToDeveloper(report.id);
  const saved = site?.developer ?? null;
  const problems = report.findings.filter((f) => f.status === 'fail').length;
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [noteTouched, setNoteTouched] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [copyToMe, setCopyToMe] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const asking = !saved || changing; // ask for the developer's details
  const shownNote = noteTouched
    ? note
    : defaultNote(asking ? name : (saved?.name ?? ''), report.hostname, problems);

  const start = () => {
    send.reset();
    setChanging(false);
    setName('');
    setEmail('');
    setNoteTouched(false);
    setAutoSend(saved?.autoSend ?? true);
    setFieldError(null);
    setOpen(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (asking && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setFieldError('Enter your developer’s name and a valid email address.');
      return;
    }
    setFieldError(null);
    send.mutate(
      {
        developer: asking ? { name: name.trim(), email: email.trim() } : undefined,
        note: shownNote,
        // Only websites in the account can remember the developer and send automatically.
        autoSend: asking && site ? autoSend : undefined,
        copyToMe,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <>
      <Button className="h-12 px-5" onClick={start}>
        <Send className="size-[18px]" aria-hidden="true" />
        Send to my developer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Send this report to your developer</DialogTitle>
          <DialogDescription>
            Sentry emails them the PDF report and your note, so they know exactly what to fix. Their
            replies come to you.
          </DialogDescription>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            {asking ? (
              <>
                <FormField id="dev-name" label="Their name">
                  <Input
                    id="dev-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldError(null);
                    }}
                    autoComplete="off"
                    maxLength={80}
                  />
                </FormField>
                <FormField id="dev-email" label="Their email" error={fieldError ?? undefined}>
                  <Input
                    id="dev-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldError(null);
                    }}
                    autoComplete="off"
                    aria-invalid={!!fieldError}
                    aria-describedby="dev-email-msg"
                  />
                </FormField>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-[10px] bg-muted px-4 py-3">
                <span className="min-w-0">
                  To <strong className="font-semibold">{saved!.name}</strong>
                  <span className="block truncate text-sm text-muted-foreground">
                    {saved!.email}
                  </span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setChanging(true)}>
                  Change
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dev-note" className="text-sm font-semibold">
                Your note
              </label>
              <textarea
                id="dev-note"
                value={shownNote}
                maxLength={1000}
                onChange={(e) => {
                  setNoteTouched(true);
                  setNote(e.target.value);
                }}
                className="min-h-24 rounded-md border border-input bg-card px-3 py-2.5 text-[0.9375rem] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            {asking && site && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="dev-auto"
                  checked={autoSend}
                  onCheckedChange={(c) => setAutoSend(c === true)}
                  className="mt-0.5"
                />
                <label htmlFor="dev-auto" className="text-[0.9375rem] leading-snug">
                  Also send {firstName(name) || 'them'} the report after every automatic check that
                  finds a problem
                </label>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="dev-copy"
                checked={copyToMe}
                onCheckedChange={(c) => setCopyToMe(c === true)}
                className="mt-0.5"
              />
              <label htmlFor="dev-copy" className="text-[0.9375rem] leading-snug">
                Send me a copy
              </label>
            </div>

            <FormError message={send.error?.message ?? null} />
            <div className="flex flex-wrap gap-2.5">
              <Button type="submit" disabled={send.isPending} aria-busy={send.isPending}>
                {send.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {send.isPending ? 'Sending…' : 'Send report'}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "✓ Sent to Tunde (tunde@…) · 7 Oct, 17:12" under the report's buttons, once it has been sent. */
export function SentToDeveloperLine({
  report,
  site,
}: {
  report: ScanReport;
  site: Domain | undefined;
}) {
  const sent = report.sentToDeveloper;
  if (!sent) return null;
  const name =
    site?.developer?.email.toLowerCase() === sent.to.toLowerCase() ? site.developer.name : null;
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-2 rounded-[10px] bg-pass-soft px-4 py-3 text-[0.9375rem]"
    >
      <span className="font-semibold text-pass">✓ Sent to {name ?? 'your developer'}</span>
      <span>
        ({sent.to}) · {sentAt.format(new Date(sent.at))}
      </span>
    </p>
  );
}
