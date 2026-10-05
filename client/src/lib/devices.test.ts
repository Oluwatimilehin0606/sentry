import { describe, expect, it } from 'vitest';
import { describeDevice, isMobileDevice } from './devices';

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
};

describe('describeDevice', () => {
  it('names the browser and the system', () => {
    expect(describeDevice(UA.chromeWindows)).toBe('Chrome on Windows');
    expect(describeDevice(UA.edgeWindows)).toBe('Edge on Windows');
    expect(describeDevice(UA.safariIphone)).toBe('Safari on iPhone');
    expect(describeDevice(UA.chromeAndroid)).toBe('Chrome on Android');
    expect(describeDevice(UA.firefoxMac)).toBe('Firefox on Mac');
  });

  it('copes with missing or unknown text', () => {
    expect(describeDevice(null)).toBe('Unknown browser');
    expect(describeDevice('curl/8.0')).toBe('Unknown browser');
  });

  it('tells phones from computers', () => {
    expect(isMobileDevice(UA.safariIphone)).toBe(true);
    expect(isMobileDevice(UA.chromeAndroid)).toBe(true);
    expect(isMobileDevice(UA.chromeWindows)).toBe(false);
  });
});
