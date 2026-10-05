/** "Chrome on Windows" from a browser's User-Agent text, for "Where you're signed in". */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? (system ? `A browser on ${system}` : 'Unknown browser');
}

/** Phones and tablets get a phone icon, everything else a computer. */
export function isMobileDevice(userAgent: string | null | undefined): boolean {
  return /iPhone|iPad|Android|Mobile/.test(userAgent ?? '');
}
