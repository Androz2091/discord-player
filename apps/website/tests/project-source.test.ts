import { describe, expect, it } from 'vitest';
import { getProjectSource } from '../src/lib/project-source';

describe('Project repository metadata', () => {
  it('derives the GitHub profile image and author from a repository URL', () => {
    expect(getProjectSource('https://github.com/example/audio-source.git')).toEqual({
      platform: 'GitHub',
      identifier: 'example/audio-source',
      author: 'example',
      imageUrl: 'https://github.com/example.png',
    });
  });

  it('ignores repository subpaths, queries, and fragments when deriving a GitHub profile', () => {
    expect(getProjectSource('https://github.com/example/audio-source/tree/main?tab=readme#usage').imageUrl).toBe(
      'https://github.com/example.png',
    );
  });

  it('infers GitLab namespaces and leaves unsupported avatars null', () => {
    expect(getProjectSource('https://gitlab.com/group/subgroup/audio-source')).toMatchObject({
      platform: 'GitLab',
      author: 'group',
      imageUrl: null,
    });
  });

  it('infers the author for custom repository hosts without guessing an avatar', () => {
    expect(getProjectSource('https://git.mylloon.fr/Anri/discord-player-example')).toMatchObject({
      platform: 'git.mylloon.fr',
      author: 'Anri',
      imageUrl: null,
    });
  });

  it.each(['https://example.com', 'https://example.com/project', 'https://github.com/example'])(
    'leaves unavailable repository metadata null for %s',
    (url) => {
      expect(getProjectSource(url)).toMatchObject({ author: null, imageUrl: null });
    },
  );

  it.each(['https://npm.im/example-package', 'https://www.npmjs.com/package/@example/package'])(
    'does not infer repository authors or images from package links: %s',
    (url) => {
      expect(getProjectSource(url)).toMatchObject({ platform: 'npm', author: null, imageUrl: null });
    },
  );
});
