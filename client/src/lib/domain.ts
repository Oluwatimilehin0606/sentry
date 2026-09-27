const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export type DomainCheck = { ok: true; hostname: string } | { ok: false; message: string };

/** Checks what the user typed and explains how to fix it in plain English. */
export function checkDomain(input: string): DomainCheck {
  const value = input.trim().toLowerCase();

  if (!value) return { ok: false, message: 'Enter your website’s domain, like yourbakery.com.' };
  if (/^https?:\/\//.test(value)) return { ok: false, message: 'Leave out https://. We add it for you.' };
  if (value.includes('/'))
    return { ok: false, message: 'Enter just the domain. Remove everything from the first “/”.' };
  if (value.includes('@'))
    return { ok: false, message: 'That looks like an email address. Enter the website domain instead.' };
  if (!HOSTNAME.test(value))
    return { ok: false, message: 'That doesn’t look like a domain. Check for typos, like yourbakery.com.' };

  return { ok: true, hostname: value };
}
