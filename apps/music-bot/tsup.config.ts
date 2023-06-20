import { defineConfig } from 'tsup';

export default defineConfig({
	dts: false,
	clean: true,
	format: ['cjs'],
	bundle: false,
	skipNodeModulesBundle: true,
	keepNames: true,
	minify: false,
	silent: true,
	entry: ['src'],
	outDir: 'dist'
});
