import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for the website's plain logic (grading, password strength, domain checks).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
