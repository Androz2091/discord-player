/* eslint-disable */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

try {
  process.loadEnvFile();
} catch {}

const otherFlags = process.argv.slice(2);
const FILE_NAME = 'package.json';
const ENTRYPOINT = join(process.cwd(), 'packages');

const isDev = process.env.DP_PUBLISH_DEV === 'true';

console.log(`\nPublish tag is set to ${isDev ? '@dev' : '@latest'}`);

const packages = await readdir(ENTRYPOINT);

// use same timestamp for all packages
const DEV_NOW = Date.now();

for (const dir of packages) {
  const path = join(ENTRYPOINT, dir, FILE_NAME);

  let packageJson = JSON.parse(await readFile(path, 'utf8'));

  if (isDev) {
    packageJson = {
      ...packageJson,
      version: `${packageJson.version}-dev.${DEV_NOW}`,
    };

    await writeFile(path, JSON.stringify(packageJson, null, 2));
  }

  const name = packageJson.name;

  console.log(`\nPublishing ${name}@${packageJson.version}`);

  const flags = [
    '--access public',
    isDev ? '--tag dev' : '',
    ...otherFlags,
  ].filter(Boolean);

  const cmd = `yarn workspace ${name} npm publish ${flags.join(' ')}`;

  console.log(`\nRunning: ${cmd} \n`);

  execSync(cmd, {
    stdio: 'inherit',
    env: process.env,
  });
}
