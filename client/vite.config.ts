import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Asks the browser for the two main fonts (Latin Public Sans and Bricolage Grotesque) at once,
 * instead of after the CSS has loaded. Otherwise pages first draw in a stand-in font and then
 * shift when the real one arrives (Lighthouse "layout shift"). Their file names change with
 * every build, so they're found in the built files.
 */
function preloadMainFonts(): Plugin {
  const MAIN = [/^assets\/public-sans-latin-wght-normal-.*\.woff2$/, /^assets\/bricolage-grotesque-latin-opsz-normal-.*\.woff2$/];
  return {
    name: 'sentry-preload-main-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        return Object.keys(bundle ?? {})
          .filter((file) => MAIN.some((re) => re.test(file)))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadMainFonts()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // The repo is public, so shipping source maps exposes nothing new and makes errors traceable.
    sourcemap: true,
  },
});
