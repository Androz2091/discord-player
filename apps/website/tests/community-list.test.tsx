import { act } from 'react';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommunityList } from '../src/components/community-list';
import { communityResources, type IShowcase } from '../src/data/community';

const contributionUrl = 'https://example.com/contribute';
const resources: IShowcase = {
  extractors: [
    {
      name: 'Audio source',
      description: 'Searchable source description',
      repositoryUrl: 'https://example.com/source',
      npmUrl: 'https://www.npmjs.com/package/audio-source',
    },
  ],
  bots: [
    {
      name: 'Current bot',
      description: 'Current example',
      version: 'v7.2.0',
      repositoryUrl: 'https://example.com/current',
    },
    { name: 'Older bot', description: 'Older example', version: 'v6.0.0', repositoryUrl: 'https://example.com/older' },
    {
      name: 'Featured bot',
      description: 'Maintainer example',
      featured: true,
      version: 'v7.1.0',
      repositoryUrl: 'https://example.com/featured',
    },
  ],
  plugins: [],
};

let container: HTMLDivElement;
let root: Root;

function tab(name: string) {
  const element = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((item) =>
    item.textContent?.startsWith(name),
  );

  if (!element) throw new Error(`Missing tab: ${name}`);

  return element;
}

function panel() {
  const element = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');

  if (!element) throw new Error('Missing active panel');

  return element;
}

async function render(data = resources) {
  await act(async () =>
    root.render(
      <ImageConfigContext value={{ ...imageConfigDefault, unoptimized: true }}>
        <CommunityList resources={data} contributionUrl={contributionUrl} />
      </ImageConfigContext>,
    ),
  );
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function search(value: string) {
  const input = panel().querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

  if (!input || !setter) throw new Error('Missing search input');

  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '/community');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Community directory', () => {
  it('defaults to extractors and exposes counts and linked tab panels', async () => {
    await render();
    expect(tab('Extractors').getAttribute('aria-selected')).toBe('true');
    expect(tab('Extractors').id).toBe('extractors');
    expect(tab('Music bots').id).toBe('bots');
    expect(tab('Plugins').id).toBe('plugins');
    expect(tab('Plugins').textContent).toContain('(0)');
    expect(panel().getAttribute('aria-labelledby')).toBe(tab('Extractors').id);
    expect(panel().textContent).toContain('Audio source');
    expect(panel().textContent).not.toContain('Current bot');
    expect(panel().querySelector('select')).toBeNull();
  });

  it('supports deep links, tab changes, and browser back/forward', async () => {
    window.history.replaceState(null, '', '/community#plugins');
    await render();
    expect(tab('Plugins').getAttribute('aria-selected')).toBe('true');
    await click(tab('Music bots'));
    expect(window.location.hash).toBe('#bots');

    await act(async () => {
      const changed = new Promise<void>((resolve) =>
        window.addEventListener('popstate', () => resolve(), { once: true }),
      );
      window.history.back();
      await changed;
    });
    expect(tab('Plugins').getAttribute('aria-selected')).toBe('true');

    await act(async () => {
      const changed = new Promise<void>((resolve) =>
        window.addEventListener('popstate', () => resolve(), { once: true }),
      );
      window.history.forward();
      await changed;
    });
    expect(tab('Music bots').getAttribute('aria-selected')).toBe('true');
  });

  it('distinguishes an empty plugins category from unmatched searches', async () => {
    await render();
    await click(tab('Plugins'));
    expect(panel().textContent).toContain('No community plugins yet');
    expect(panel().textContent).not.toContain('No projects match your filters');
    expect(panel().querySelector('a')?.getAttribute('href')).toBe(contributionUrl);
    expect(panel().querySelector('a')?.textContent).toContain('Add your plugin');
    expect(communityResources.plugins).toEqual([]);
  });

  it('searches descriptions, clears searches, and resets unmatched results', async () => {
    await render();
    await search('searchable source');
    expect(panel().textContent).toContain('Audio source');
    await search('no-such-resource');
    expect(panel().textContent).toContain('No projects match your filters');
    const reset = [...panel().querySelectorAll('button')].find((button) => button.textContent === 'Reset filters');
    if (!reset) throw new Error('Missing reset action');
    await click(reset);
    expect(panel().textContent).toContain('Audio source');
    expect(document.activeElement).toBe(panel().querySelector('input'));
    await search('no-such-resource');
    const clear = panel().querySelector<HTMLButtonElement>('[aria-label="Clear search"]');
    if (!clear) throw new Error('Missing clear action');
    await click(clear);
    expect(panel().textContent).toContain('Audio source');
  });

  it('filters bot versions while preserving maintainer picks', async () => {
    await render();
    await click(tab('Music bots'));
    const select = panel().querySelector('select');
    if (!select) throw new Error('Missing version filter');
    await act(async () => {
      select.value = 'v7';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(panel().textContent).toContain('Current bot');
    expect(panel().textContent).not.toContain('Older bot');
    expect(panel().textContent).toContain('Maintainer pick');
    expect(panel().textContent).toContain('Discord Player v7.2.0');
  });

  it('supports keyboard focus navigation and activation', async () => {
    await render();
    await act(async () => tab('Extractors').focus());
    await act(async () =>
      tab('Extractors').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(document.activeElement).toBe(tab('Music bots'));
    await act(async () => tab('Music bots').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(tab('Plugins'));
    expect(tab('Plugins').getAttribute('aria-selected')).toBe('true');
    expect(window.location.hash).toBe('#plugins');
  });

  it('uses the same searchable cards for future plugin submissions', async () => {
    await render({
      ...resources,
      plugins: [
        { name: 'Queue extension', description: 'Queue behavior plugin', repositoryUrl: 'https://example.com/plugin' },
      ],
    });
    await click(tab('Plugins'));
    expect(panel().textContent).toContain('Queue extension');
    expect(panel().querySelector('a')?.getAttribute('href')).toBe('https://example.com/plugin');
    expect(panel().querySelector('select')).toBeNull();
    await search('missing');
    expect(panel().textContent).toContain('No projects match your filters');
    expect(panel().textContent).not.toContain('No community plugins yet');
  });
  it('renders separate repository, npm, and website actions without nested links', async () => {
    await render({
      ...resources,
      extractors: [
        {
          ...resources.extractors[0],
          name: 'Rich source',
          description: 'An audio source',
          repositoryUrl: 'https://github.com/example/audio-source',
          npmUrl: 'https://www.npmjs.com/package/audio-source',
          author: 'Source author',
          featured: true,
        },
      ],
    });
    const card = panel().querySelector('article');
    expect(card?.textContent).toContain('Source author');
    expect(card?.textContent).toContain('example/audio-source');
    expect(card?.querySelector('[aria-label="Repository for Rich source"]')?.getAttribute('href')).toBe(
      'https://github.com/example/audio-source',
    );
    expect(card?.querySelector('[aria-label="npm for Rich source"]')?.getAttribute('href')).toBe(
      'https://www.npmjs.com/package/audio-source',
    );
    expect(card?.querySelector('a a')).toBeNull();
    await search('Source author');
    expect(panel().textContent).toContain('Rich source');
  });

  it('supports website-only bots and does not infer compatibility from featured status', async () => {
    await render({
      ...resources,
      bots: [
        ...resources.bots,
        { name: 'Website bot', description: 'Hosted project', websiteUrl: 'https://example.com/bot', featured: true },
      ],
    });
    await click(tab('Music bots'));
    const card = [...panel().querySelectorAll('article')].find((entry) => entry.textContent?.includes('Website bot'));
    expect(card?.querySelector('a')?.textContent).toContain('Website');
    expect(card?.textContent).toContain('Maintainer pick');
    expect(card?.textContent).not.toContain('Discord Player');
    const select = panel().querySelector('select');
    if (!select) throw new Error('Missing version filter');
    await act(async () => {
      select.value = 'v7';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(panel().textContent).not.toContain('Website bot');
  });

  it('infers GitHub avatars and falls back to initials on image errors', async () => {
    await render({
      ...resources,
      extractors: [
        {
          name: 'Custom source',
          description: 'An audio source',
          repositoryUrl: 'https://github.com/example/audio-source',
          npmUrl: 'https://www.npmjs.com/package/audio-source',
        },
      ],
    });
    const image = panel().querySelector('img');
    if (!image) throw new Error('Missing project icon');
    expect(image.getAttribute('src')).toBe('https://github.com/example.png');
    await act(async () => image.dispatchEvent(new Event('error')));
    expect(panel().querySelector('img')).toBeNull();
    expect(panel().querySelector('article')?.textContent).toContain('CU');
  });

  it('uses initials for unsupported hosts', async () => {
    await render({
      ...resources,
      extractors: [
        {
          name: 'Local source',
          description: 'An audio source',
          repositoryUrl: 'https://example.com/repo',
          npmUrl: 'https://www.npmjs.com/package/audio-source',
        },
      ],
    });
    expect(panel().querySelector('img')).toBeNull();
    expect(panel().querySelector('article')?.textContent).toContain('LO');
  });

  it('retains eligible listings, excludes muusik.app, and requires extractor repository and npm links', () => {
    expect(communityResources.extractors).toHaveLength(14);
    expect(communityResources.bots).toHaveLength(29);
    expect(
      communityResources.bots.some((entry) => entry.name === 'muusik.app' || entry.websiteUrl === 'https://muusik.app'),
    ).toBe(false);
    expect(communityResources.extractors.every((entry) => entry.repositoryUrl.startsWith('https://'))).toBe(true);
    expect(communityResources.bots.every((entry) => entry.repositoryUrl || entry.websiteUrl)).toBe(true);
    expect(communityResources.bots.some((entry) => entry.version === 'Promoted')).toBe(false);
  });
  it('renders deprecation independently of the project name and version', async () => {
    const cadence = communityResources.bots.find((entry) => entry.name === 'Cadence');
    expect(cadence?.deprecated).toBe(true);
    if (!cadence) throw new Error('Missing Cadence listing');
    await render({ ...resources, bots: [cadence] });
    await click(tab('Music bots'));
    expect(panel().querySelector('h2')?.textContent).toBe('Cadence');
    expect(panel().textContent).toContain('Deprecated');
    const badge = [...panel().querySelectorAll('span')].find((element) => element.textContent === 'Deprecated');
    expect(badge?.classList.contains('text-fd-error')).toBe(true);
    expect(panel().textContent).toContain('Discord Player v6.7.1');
  });
  it('derives custom repository authors without requesting unsupported avatars', async () => {
    await render({
      ...resources,
      extractors: [
        {
          name: 'Custom source',
          description: 'An audio source',
          repositoryUrl: 'https://git.mylloon.fr/Anri/discord-player-example',
          npmUrl: 'https://www.npmjs.com/package/audio-source',
        },
      ],
    });
    expect(panel().textContent).toContain('by Anri');
    expect(panel().querySelector('img')).toBeNull();
  });
  it('renders repository and npm actions for every listed extractor', async () => {
    await render(communityResources);
    const cards = [...panel().querySelectorAll('article')];

    expect(cards).toHaveLength(communityResources.extractors.length);

    for (const [index, entry] of communityResources.extractors.entries()) {
      const npmUrl = new URL(entry.npmUrl);

      expect(npmUrl.protocol).toBe('https:');
      expect(['npm.im', 'www.npmjs.com']).toContain(npmUrl.hostname);
      expect(cards[index]?.querySelector('[aria-label^="Repository for "]')?.getAttribute('href')).toBe(
        entry.repositoryUrl,
      );
      expect(cards[index]?.querySelector('[aria-label^="npm for "]')?.getAttribute('href')).toBe(entry.npmUrl);
    }
  });
  it.each(['https://github.com/example/audio-source', 'https://example.com/audio-source'])(
    'ignores custom icon URLs even when supplied as extra metadata for %s',
    async (repositoryUrl) => {
      const extractor = {
        ...resources.extractors[0],
        repositoryUrl,
        icon: 'https://unapproved.example/custom.png',
      };

      await render({ ...resources, extractors: [extractor] });

      const image = panel().querySelector('img');

      if (repositoryUrl.startsWith('https://github.com/')) {
        expect(image?.getAttribute('src')).toBe('https://github.com/example.png');
      } else {
        expect(image).toBeNull();
      }
    },
  );
});
