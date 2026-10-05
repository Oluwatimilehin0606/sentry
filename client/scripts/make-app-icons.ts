// `node client/scripts/make-app-icons.ts`: draws the installable app's icons (approved option A:
// the Sentry mark in white on Sentry blue) into client/public/icons/, using the browser that the
// browser test uses. Run it again only if the logo changes.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = path.resolve(import.meta.dirname, '../public/icons');
const BLUE = '#1F5FAD';

// The approved logo (client/src/components/Logo.tsx): two halves with the S cut out between them.
const LEFT_HALF = 'M12 2.3 8.7 10.1 14 14.2 12 21.7C7.2 18.4 4.6 12.5 4.8 6.4Z';
const RIGHT_HALF = 'M12 2.3 19.2 6.4C19.4 12.5 16.8 18.4 12 21.7L14 14.2 8.7 10.1Z';
const S_CUT = 'M12 2.3 8.7 10.1 14 14.2 12 21.7';

/**
 * One icon, `size` pixels square. `mark` is the logo's share of the width; `radius` rounds the
 * corners (0 for icons the phone shapes itself: Android's maskable icon and the iPhone's).
 */
function svg(size: number, mark: number, radius: number): string {
  const scale = (size * mark) / 24;
  const offset = (size - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><mask id="s" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
    <rect width="24" height="24" fill="white"/>
    <path d="${S_CUT}" fill="none" stroke="black" stroke-width="1.2" stroke-linejoin="miter"/>
  </mask></defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BLUE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" mask="url(#s)" fill="#FFFFFF">
    <path d="${LEFT_HALF}"/><path d="${RIGHT_HALF}" opacity="0.5"/>
  </g>
</svg>`;
}

const ICONS = [
  // Browsers and desktop installs: a rounded tile, like the mockup.
  { file: 'icon-192.png', size: 192, mark: 0.8, radius: 0.23 },
  { file: 'icon-512.png', size: 512, mark: 0.8, radius: 0.23 },
  // Android cuts its own shape out of this, so the mark stays inside the central safe circle.
  { file: 'maskable-512.png', size: 512, mark: 0.62, radius: 0 },
  // iPhone home screen (it rounds the corners itself).
  { file: 'apple-touch-icon.png', size: 180, mark: 0.72, radius: 0 },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(icon.size, icon.mark, icon.radius)}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(OUT, icon.file), omitBackground: true });
    console.log(`✓ ${icon.file}`);
  }
} finally {
  await browser.close();
}
