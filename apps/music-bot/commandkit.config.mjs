import { defineConfig } from 'commandkit';

export default defineConfig({
  main: 'index.js',
  src: 'src',
  antiCrash: true,
  requirePolyfill: true,
  outDir: 'dist',
  minify: false,
  sourcemap: true,
});
