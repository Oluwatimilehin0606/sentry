import { describe, expect, it } from 'vitest';
import { isCoveredBy, recordName, type Domain } from '@/lib/domains';

describe('recordName', () => {
  it.each([
    ['yourbakery.com', '@'],
    ['mechspec.com.ng', '@'],
    ['yourbakery.co.uk', '@'],
    ['shop.yourbakery.com', 'shop'],
    ['shop.yourbakery.com.ng', 'shop'],
    ['a.b.yourbakery.com', 'a.b'],
  ])('%s → %s', (hostname, name) => {
    expect(recordName(hostname)).toBe(name);
  });
});

describe('isCoveredBy', () => {
  const site = (hostname: string, verified: boolean): Domain => ({
    id: hostname,
    hostname,
    verifiedAt: verified ? '2026-10-01T00:00:00Z' : null,
    createdAt: '2026-10-01T00:00:00Z',
    record: { type: 'TXT', value: 'sentry-verify=0' },
  });

  it('matches the server: a verified domain covers itself and its subdomains only', () => {
    const list = [site('yourbakery.com', true), site('other.example', false)];
    expect(isCoveredBy(list, 'yourbakery.com')).toBe(true);
    expect(isCoveredBy(list, 'shop.yourbakery.com')).toBe(true);
    expect(isCoveredBy(list, 'notyourbakery.com')).toBe(false);
    expect(isCoveredBy(list, 'other.example')).toBe(false);
    expect(isCoveredBy(undefined, 'yourbakery.com')).toBe(false);
  });
});
