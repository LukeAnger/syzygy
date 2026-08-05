/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/syzygy/',
  plugins: [react()],
  // Vitest and a running dev server otherwise share `node_modules/.vite`, and
  // whichever re-optimizes first pulls the cache out from under the other —
  // which surfaced as every test file at once reporting "No test suite found"
  // while `npm run dev` happened to be up. Bisected: dev server running, all 19
  // files fail; dev server stopped, all pass. Separate caches, no collision.
  cacheDir: process.env['VITEST'] ? 'node_modules/.vite-test' : 'node_modules/.vite',
  server: {
    watch: {
      // Build and coverage output are not sources, and `npm run ci` rewrites
      // the whole coverage tree mid-run. Watching it just thrashes reloads.
      ignored: ['**/coverage/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Coverage standards are enforced for the exact-arithmetic core: the math
      // primitives, the solver engine, and the domain equation packs. NLP is
      // fuzzy-match quality and gets its own standards system (see docs/SPEC.md);
      // UI/state are exercised differently. Neither is gated here.
      include: [
        'src/math/**/*.ts',
        'src/engine/**/*.ts',
        'src/domains/**/*.ts',
      ],
      // Barrels are pure re-exports; type-only files carry no runtime logic.
      exclude: ['**/index.ts', '**/types.ts', '**/*.d.ts'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
