import { defineConfig } from 'vitest/config';

/** Vitest configuration for the Discord Player package. */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
