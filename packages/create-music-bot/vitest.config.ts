import { defineConfig } from 'vitest/config';

/** Vitest configuration for the project generator. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
