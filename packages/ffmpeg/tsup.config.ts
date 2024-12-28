import { defineConfig } from '../../tsup.config';
import { esbuildPluginUseMacro } from 'use-macro';

export default defineConfig({
  format: ['cjs'],
  esbuildPlugins: [esbuildPluginUseMacro()],
});
