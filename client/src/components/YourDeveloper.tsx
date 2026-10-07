import { Loader2 } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRemoveDeveloper, useSaveDeveloper, type Domain } from '@/lib/domains';

/**
 * "Your developer" on a website's page (approved mockup): who gets this website's reports, and
 * whether automatically after every automatic check that finds a problem.
 */
export function YourDeveloper({ domain }: { domain: Domain }) {
  const save = useSaveDeveloper();
  const remove = useRemoveDeveloper();
  const id = useId();
  const developer = domain.developer;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const startEditing = () => {
    save.reset();
    setName(developer?.name ?? '');
    setEmail(developer?.email ?? '');
    setFieldError(null);
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Enter your developer’s name and a valid email address.');
      return;
    }
    save.mutate(
      {
        id: domain.id,
        name: name.trim(),
        email: email.trim(),
        autoSend: developer?.autoSend ?? true,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <section
      aria-labelledby={`${id}-h`}
      className="flex flex-col gap-4 rounded-[14px] border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="font-display text-xl font-bold tracking-tight">
          Your developer
        </h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          Whoever built {domain.hostname}. “Send to my developer” on a report emails them the report
          and your note.
        </p>
      </div>

      {editing ? (
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3.5">
          <FormField id={`${id}-name`} label="Their name">
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldError(null);
              }}
              maxLength={80}
              autoComplete="off"
            />
          </FormField>
          <FormField id={`${id}-email`} label="Their email" error={fieldError ?? undefined}>
            <Input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(null);
              }}
              autoComplete="off"
              aria-invalid={!!fieldError}
              aria-describedby={`${id}-email-msg`}
            />
          </FormField>
          <FormError message={save.error?.message ?? null} />
          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : developer ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <strong className="font-semibold">{developer.name}</strong>
              <span className="block truncate text-sm text-muted-foreground">
                {developer.email}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={startEditing}>
              Change
            </Button>
          </div>
          <label className="flex cursor-pointer items-start gap-3 border-t pt-4">
            <input
              type="checkbox"
              checked={developer.autoSend}
              disabled={save.isPending}
              onChange={(e) =>
                save.mutate({ id: domain.id, ...developer, autoSend: e.target.checked })
              }
              className="mt-1 size-4.5 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-semibold">Send after automatic checks that find a problem</span>
              <span className="text-sm text-muted-foreground">
                {developer.name} gets the report straight away, with the problems to fix.
                {domain.rescanInterval === 'none' &&
                  ' Turn on automatic checks above for this to apply.'}
              </span>
            </span>
          </label>
          <FormError message={(save.error ?? remove.error)?.message ?? null} />
          <Button
            variant="link"
            className="h-auto self-start p-0 text-critical"
            disabled={remove.isPending}
            onClick={() => remove.mutate(domain.id)}
          >
            Remove developer
          </Button>
        </>
      ) : (
        <Button variant="outline" className="h-10.5 self-start" onClick={startEditing}>
          Add your developer
        </Button>
      )}
    </section>
  );
}
