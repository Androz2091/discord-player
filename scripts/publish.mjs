/* eslint-disable */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const otherFlags = process.argv.slice(2);
const FILE_NAME = 'package.json';
const ENTRYPOINT = join(process.cwd(), 'packages');

const packages = await readdir(ENTRYPOINT);

for (const dir of packages) {
  const path = join(ENTRYPOINT, dir, FILE_NAME);
  const packageJson = JSON.parse(await readFile(path, 'utf8'));

  const name = packageJson.name;
  const tag = packageJson.version.split('-')[1]?.split('.')[0];

  const cmd = `yarn workspace ${name} npm publish --access public${tag ? ` --tag ${tag}` : ''}${
    otherFlags.length ? ` ${otherFlags.join(' ')}` : ''
  }`;

  console.log(`\nRunning: ${cmd}\n`);

  execSync(cmd, {
    stdio: 'inherit',
  });
}
