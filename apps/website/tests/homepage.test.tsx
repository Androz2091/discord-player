import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../src/app/(home)/page';
import { communityResources } from '../src/data/community';
import { discordInviteUrl } from '../src/lib/shared';
import { getDefaultDocsVersion, getDocsVersion, getVersionBaseUrl } from '../src/lib/versions';

// Highlighting is provided by Fumadocs on the server; exercise the page's content and interactions here.
vi.mock('fumadocs-ui/components/codeblock.rsc', () => ({
  ServerCodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<HomePage />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Homepage', () => {
  it('links the primary action to stable setup and keeps the preview distinct', () => {
    const stable = getDefaultDocsVersion();
    const preview = getDocsVersion('v8');
    const hero = container.querySelector('[aria-labelledby="hero-heading"]');
    const links = [...(hero?.querySelectorAll('a') ?? [])];

    expect(links.find((link) => link.textContent?.includes('Get started'))?.getAttribute('href')).toBe(
      `${getVersionBaseUrl(stable.id)}${stable.startPath ?? ''}`,
    );
    expect(links.find((link) => link.textContent?.includes(`Explore ${preview.name}`))?.getAttribute('href')).toBe(
      getVersionBaseUrl(preview.id),
    );
    expect(hero?.textContent).toContain(`${stable.name} is stable`);
    expect(hero?.textContent).toContain(`${preview.name} is a development preview`);
  });

  it('retains the actual Discord invite and the copyable generator inside the hero', () => {
    const hero = container.querySelector('[aria-labelledby="hero-heading"]');
    const invite = hero?.querySelector('[aria-labelledby="discord-invite-heading"]');

    expect(invite?.textContent).toContain('AndrozDev');
    expect(invite?.querySelector('a')?.getAttribute('href')).toBe(discordInviteUrl);
    expect(hero?.querySelector('code')?.textContent).toContain('npm create music-bot@dev');
    expect([...(hero?.querySelectorAll('button') ?? [])].some((button) => button.textContent === 'Copy')).toBe(true);
  });

  it('switches between embedded and remote runtime examples with the correct documentation links', async () => {
    const section = container.querySelector('[aria-labelledby="v8-heading"]');
    expect(section?.textContent).toContain("type: 'embedded'");
    const remote = [...(section?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].find(
      (tab) => tab.textContent === 'Remote',
    );
    if (!remote) throw new Error('Missing Remote runtime tab');
    await act(async () => remote.click());

    expect(remote.getAttribute('aria-selected')).toBe('true');
    expect(section?.textContent).toContain('remedias://audio.example.com');
    expect(section?.querySelector('a[href="/docs/v8/remedia/remote"]')).not.toBeNull();
    expect(section?.querySelector('a[href="/docs/v8/plugins/remote-hosts"]')).not.toBeNull();
    expect(section?.querySelector('a[href="/docs/v8/migration"]')).not.toBeNull();
  });

  it('previews current resource categories and keeps the complete directory one link away', () => {
    const section = container.querySelector('[aria-labelledby="community-heading"]');
    for (const category of ['extractors', 'plugins', 'bots']) {
      expect(section?.querySelector(`a[href="/community#${category}"]`)).not.toBeNull();
    }
    expect(section?.querySelector('a[href="/community"]')).not.toBeNull();
    expect(section?.textContent).toContain(communityResources.extractors[0]?.name);
    expect(section?.textContent).toContain(communityResources.bots[0]?.name);
    expect(section?.querySelectorAll('li')).toHaveLength(4);
    expect(section?.textContent).toContain('No community plugins listed yet.');
  });
});
