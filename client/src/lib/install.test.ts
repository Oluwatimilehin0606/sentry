import { afterEach, describe, expect, it, vi } from 'vitest';
import { offerAndroidApp } from './install';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** A browser with this User-Agent, running as a web page or as the installed app. */
function browser(userAgent: string, { installed = false, touchPoints = 0 } = {}) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: touchPoints });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: installed }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('“Get the Android app” on the landing page', () => {
  it('is offered on Android phones and computers', () => {
    browser(ANDROID);
    expect(offerAndroidApp()).toBe(true);
    browser(WINDOWS);
    expect(offerAndroidApp()).toBe(true);
  });

  it('is not offered on iPhones and iPads, which can’t install it', () => {
    browser(IPHONE);
    expect(offerAndroidApp()).toBe(false);
    // iPads say "Macintosh" now, but have a touch screen.
    browser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', { touchPoints: 5 });
    expect(offerAndroidApp()).toBe(false);
  });

  it('is not offered inside the installed app itself', () => {
    browser(ANDROID, { installed: true });
    expect(offerAndroidApp()).toBe(false);
  });
});
