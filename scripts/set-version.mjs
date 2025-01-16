/* eslint-disable */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const VERSION_PATTERN = /^\d+\.\d+\.\d+?/;
const version = process.argv[2];

if (!version) {
  console.error('Usage: command <version>');
  process.exit(1);
}

if (!VERSION_PATTERN.test(version)) {
  console.error(
    'Invalid version format. Use semver format: <major>.<minor>.<patch>',
  );
  process.exit(1);
}

const FILE_NAME = 'package.json';
const ENTRYPOINT = join(process.cwd(), 'packages');

const packages = await readdir(ENTRYPOINT);

for (const dir of packages) {
  try {
    const path = join(ENTRYPOINT, dir, FILE_NAME);
    const packageJson = JSON.parse(await readFile(path, 'utf8'));

    const oldVersion = packageJson.version;

    if (oldVersion === version) {
      console.log(`Version in ${dir} is already up to date.`);
      continue;
    }

    packageJson.version = version;

    console.log(`Updating version in ${dir} from ${oldVersion} to ${version}`);

    await writeFile(path, JSON.stringify(packageJson, null, 2));
  } catch (e) {
    console.error(`Error updating version in ${dir}: ${e.message}`);
  }
}
