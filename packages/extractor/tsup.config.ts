import { defineConfig } from '../../tsup.config';
import { esbuildPluginUseMacro } from 'use-macro';

export default defineConfig({
  esbuildPlugins: [esbuildPluginUseMacro()],
});
