// Mirrors client/src/lib/domain.ts. The server never trusts the client's check.
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeHostname(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\.$/, '');
  return HOSTNAME.test(value) ? value : null;
}
