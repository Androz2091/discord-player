import { describe, expect, it } from 'vitest';
import { createRemediaNodes } from '../src/lib/remedia-config.ts';

describe('Remedia bot mode configuration', () => {
  it('defaults to embedded playback', () => {
    expect(createRemediaNodes({})).toEqual([{ id: 'local', type: 'embedded' }]);
    expect(createRemediaNodes({ REMEDIA_MODE: 'embedded' })).toEqual([{ id: 'local', type: 'embedded' }]);
  });

  it('builds an authenticated remote node', () => {
    expect(
      createRemediaNodes({
        REMEDIA_MODE: 'remote',
        REMEDIA_URL: 'remedias://audio.example.com',
        REMEDIA_USERNAME: 'music',
        REMEDIA_PASSWORD: 'secret',
      }),
    ).toEqual([
      {
        id: 'remote',
        type: 'remote',
        url: 'remedias://audio.example.com',
        auth: { username: 'music', password: 'secret' },
      },
    ]);
  });

  it('rejects invalid or incomplete configuration without leaking credentials', () => {
    expect(() => createRemediaNodes({ REMEDIA_MODE: 'invalid' })).toThrow(/REMEDIA_MODE/);
    for (const missing of ['REMEDIA_URL', 'REMEDIA_USERNAME', 'REMEDIA_PASSWORD'] as const) {
      const env = {
        REMEDIA_MODE: 'remote',
        REMEDIA_URL: 'remedias://audio.example.com',
        REMEDIA_USERNAME: 'music',
        REMEDIA_PASSWORD: 'secret',
      };
      delete (env as Record<string, string | undefined>)[missing];
      expect(() => createRemediaNodes(env)).toThrow(/requires REMEDIA_URL/);
    }
  });
});
