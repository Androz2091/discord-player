function getVersion(): string {
  'use macro';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../package.json').version;
}

export const version = getVersion();
