/* eslint-disable */

const { stripIndents } = require('common-tags');
const { copy, exists, ensureDir, writeFile } = require('fs-extra');
const chalk = require('ansi-colors');

const destName = process.argv[2];
const DP_PKG = /^@discord\-player\/(.+)$/;
const TARGET_DIR = `${__dirname}/../packages`;

function getData(name) {
  name = name.startsWith('@discord-player/') ? name : `@discord-player/${name}`;

  return [
    { name: 'package.json', data: getPackageJSON(name) },
    { name: 'README.md', data: getReadMe(name) },
    { name: 'tsconfig.json', data: getTSConfig() },
  ];
}

function getTSConfig() {
  return JSON.stringify(
    {
      extends: '@discord-player/tsconfig/base.json',
      include: ['src/**/*'],
    },
    null,
    4,
  );
}

function getReadMe(name) {
  return stripIndents`# \`${name}\`\n
    Discord Player \`${name}\` library\n
    ## Installation\n
    \`\`\`sh
    $ yarn add ${name}
    \`\`\`\n
    ## Example\n
    \`\`\`js\nimport pkg from "${name}"\n\`\`\`\n`;
}

function getPackageJSON(name) {
  const packageJson = JSON.stringify(
    {
      name,
      version: '0.1.0',
      description:
        'A complete framework to simplify the implementation of music commands for Discord bots',
      keywords: [
        'discord-player',
        'music',
        'bot',
        'discord.js',
        'javascript',
        'voip',
        'lavalink',
        'lavaplayer',
      ],
      author: 'Androz2091 <androz2091@gmail.com>',
      homepage: 'https://discord-player.js.org',
      license: 'MIT',
      main: 'dist/index.js',
      module: 'dist/index.mjs',
      types: 'dist/index.d.ts',
      files: ['dist'],
      repository: {
        type: 'git',
        url: 'git+https://github.com/Androz2091/discord-player.git',
      },
      scripts: {
        build: 'tsup',
        'build:check': 'tsc --noEmit',
        lint: 'eslint src --ext .ts --fix',
        test: 'vitest',
        coverage: 'vitest run --coverage',
      },
      bugs: {
        url: 'https://github.com/Androz2091/discord-player/issues',
      },
      devDependencies: {
        '@discord-player/tsconfig': 'workspace:^',
      },
    },
    null,
    2,
  );

  return packageJson;
}

async function main() {
  if (!destName)
    return console.log(chalk.redBright('✘ Package name is required!'));
  const match = destName.match(DP_PKG);
  const name = match?.[1] || destName;

  if (await exists(`${TARGET_DIR}/${name}`))
    return console.log(
      chalk.redBright(`✘ Cannot create ${name} as it already exists.`),
    );

  console.log(chalk.cyanBright(`▲ Generating project...`));
  await ensureDir(`${TARGET_DIR}/${name}`);

  await copy(`${__dirname}/template`, `${TARGET_DIR}/${name}`);

  for (const data of getData(destName)) {
    await writeFile(`${TARGET_DIR}/${name}/${data.name}`, data.data);
  }

  console.log(chalk.greenBright(`✔ Successfully bootstrapped ${name}!`));
}

main().catch((e) => {
  console.log(
    `${chalk.redBright('Failed to bootstrap!')}\n\n${chalk.red(`${e}`)}`,
  );
});
