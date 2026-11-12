import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A place to fund the project. */
export interface FundingLink {
  /** Name of the platform, such as `GitHub Sponsors`. */
  label: string;

  /** Page where visitors can sponsor the project. */
  url: string;
}

/** Platforms from GitHub's `FUNDING.yml` format that map to a sponsor page. */
const platforms: Record<string, { label: string; url: (handle: string) => string }> = {
  github: { label: 'GitHub Sponsors', url: (handle) => `https://github.com/sponsors/${handle}` },
  patreon: { label: 'Patreon', url: (handle) => `https://www.patreon.com/${handle}` },
  open_collective: { label: 'Open Collective', url: (handle) => `https://opencollective.com/${handle}` },
  ko_fi: { label: 'Ko-fi', url: (handle) => `https://ko-fi.com/${handle}` },
  liberapay: { label: 'Liberapay', url: (handle) => `https://liberapay.com/${handle}` },
  buy_me_a_coffee: { label: 'Buy Me a Coffee', url: (handle) => `https://www.buymeacoffee.com/${handle}` },
};

/**
 * Reads the repository's `.github/FUNDING.yml` so the sponsor links on the website match it.
 * Only single-value `platform: handle` entries of the supported platforms are used.
 * Run from `apps/website`, which is where the build and dev server start.
 */
export function getFundingLinks(): FundingLink[] {
  const file = resolve(process.cwd(), '../../.github/FUNDING.yml');
  const links: FundingLink[] = [];

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([a-z_]+):\s*['"]?([^\s'"#]+)['"]?\s*(?:#.*)?$/.exec(line.trim());
    const platform = match?.[1] ? platforms[match[1]] : undefined;

    if (platform && match?.[2]) links.push({ label: platform.label, url: platform.url(match[2]) });
  }

  return links;
}
