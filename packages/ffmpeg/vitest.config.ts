import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: `${__dirname}/__test__`,
    passWithNoTests: true,
    watch: false,
  },
});
