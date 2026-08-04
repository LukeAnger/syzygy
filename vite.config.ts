/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/syzygy/',
  plugins: [react()],
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
      // Coverage standards are enforced for the computational core only:
      // the math primitives and the domain equation packs. UI/state are
      // exercised differently and are not gated here.
      include: ['src/math/**/*.ts', 'src/domains/**/*.ts'],
      // Barrels are pure re-exports; type-only files carry no runtime logic.
      exclude: ['**/index.ts', '**/*.d.ts'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
