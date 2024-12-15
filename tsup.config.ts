import { defineConfig as tsupDefineConfig, Options } from 'tsup';

export function defineConfig({
  clean = true,
  bundle = true,
  dts = true,
  format = ['cjs', 'esm'],
  keepNames = true,
  minify = false,
  esbuildPlugins = [],
  entry = ['./src/index.ts'],
  skipNodeModulesBundle = true,
  sourcemap = 'inline',
  target = 'es2020',
  silent = true,
  shims = true,
}: Options) {
  return tsupDefineConfig({
    clean,
    bundle,
    dts,
    format,
    keepNames,
    minify,
    esbuildPlugins,
    entry,
    skipNodeModulesBundle,
    sourcemap,
    target,
    silent,
    shims,
  });
}
