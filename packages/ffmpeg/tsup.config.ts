import { defineConfig } from '../../tsup.config';
import { esbuildPluginVersionInjector } from 'esbuild-plugin-version-injector';

export default defineConfig({
  format: ['cjs'],
  esbuildPlugins: [esbuildPluginVersionInjector()],
});
