import { defineConfig } from 'tsup';

export default defineConfig({
    clean: true,
    bundle: true,
    dts: true,
    format: ['cjs', 'esm'],
    keepNames: true,
    minify: false,
    entry: ['./src/index.ts'],
    skipNodeModulesBundle: true,
    sourcemap: true,
    target: 'ES2020',
    silent: true
});
