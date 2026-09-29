import { describe, expect, it } from 'vitest';
import { checkDomain } from '@/lib/domain';

describe('checkDomain', () => {
  it('accepts a domain and normalises it', () => {
    expect(checkDomain('  YourBakery.COM ')).toEqual({ ok: true, hostname: 'yourbakery.com' });
    expect(checkDomain('shop.yourbakery.co.uk')).toEqual({ ok: true, hostname: 'shop.yourbakery.co.uk' });
  });

  it.each([
    ['', /Enter your website’s domain/],
    ['https://yourbakery.com', /Leave out https:\/\//],
    ['yourbakery.com/menu', /Remove everything from the first/],
    ['ada@yourbakery.com', /looks like an email address/],
    ['localhost', /doesn’t look like a domain/],
    ['not a domain', /doesn’t look like a domain/],
  ])('explains how to fix %j', (input, message) => {
    const result = checkDomain(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });
});
