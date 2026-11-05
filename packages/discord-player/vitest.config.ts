import { defineConfig } from 'vitest/config';

/** Vitest configuration for the Discord Player package. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    restoreMocks: true,
  },
});
