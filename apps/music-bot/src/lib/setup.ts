import '@sapphire/plugin-api/register';
import '@sapphire/plugin-hmr/register';
import '@sapphire/plugin-logger/register';
import { setup, type ArrayString } from '@skyra/env-utilities';
import { join } from 'path';

const rootDir = join(__dirname, '..', '..');
const srcDir = join(rootDir, 'src');
setup({ path: join(srcDir, '.env') });

declare module '@skyra/env-utilities' {
	interface Env {
		OWNERS: ArrayString;
	}
}
