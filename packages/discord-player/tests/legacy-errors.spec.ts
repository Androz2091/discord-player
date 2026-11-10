import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { BaseExtractor, DiscordPlayer, Track, type NextFunction } from '../src/index.js';

class Raw extends BaseExtractor<{ location?: string }> {
  static override identifier = 'org.example.raw';

  override async stream() {
    return Readable.from(['encoded']);
  }
}

const player = () => new DiscordPlayer({ nodes: [], send() {} });

it('owns legacy bundles, disabled status, replacement configuration and complete unregistration', async () => {
  const p = new DiscordPlayer({ nodes: [], send() {}, blockExtractors: ['blocked'] });

  class Another extends Raw {
    static override identifier = 'org.example.another';
  }

  await p.extractors.loadMulti([Raw, Another], { [Raw.identifier]: { location: 'configured' } });

  expect(p.extractors.store.size).toBe(2);
  expect(p.extractors.isRegistered(Raw.identifier)).toBe(true);
  expect(p.extractors.get(Raw.identifier)?.options).toEqual({ location: 'configured' });
  expect(p.extractors.isDisabled('blocked')).toBe(true);
  expect(p.extractors.isEnabled(Raw.identifier)).toBe(true);

  await expect(p.extractors.reconfigure('missing', {})).rejects.toThrow('Unknown extractor');
  await p.extractors.unregister(p.extractors.get(Raw.identifier)!);

  expect(p.extractors.isRegistered(Raw.identifier)).toBe(false);

  await p.extractors.unregisterAll();

  expect(p.extractors.size).toBe(0);
  expect(await p.extractors.unregister('missing')).toBe(false);

  await p.destroy();
});

it('cleans legacy activation failures and exposes failure provenance', async () => {
  const p = player();
  let deactivated = 0;

  class Broken extends Raw {
    static override identifier = 'org.example.broken';

    override async activate() {
      throw new Error('activate failed');
    }

    override async deactivate() {
      deactivated++;
    }
  }

  await expect(p.extractors.register(Broken)).rejects.toMatchObject({
    pluginId: Broken.identifier,
    operation: 'setup',
  });

  expect(deactivated).toBe(1);
  expect(p.extractors.isRegistered(Broken.identifier)).toBe(false);
  expect(p.plugins.has(Broken.identifier)).toBe(false);

  await p.destroy();
});

it.each(['callback', 'throw'] as const)(
  'attributes %s post-stream failures and disposes the original stream',
  async (mode) => {
    const p = player();
    const stream = Readable.from(['encoded']);

    class Broken extends Raw {
      override async stream() {
        return stream;
      }

      override handlePostStream(_stream: Readable, next: NextFunction) {
        if (mode === 'throw') throw new Error('post failed');

        next(new Error('post failed'));
      }
    }

    await p.extractors.register(Broken);

    const track = new Track({ sourceReference: { pluginId: Broken.identifier, data: null } });

    await expect(p.plugins.resolveStream(track)).rejects.toMatchObject({
      pluginId: Broken.identifier,
      operation: 'stream.transform',
    });

    expect(stream.destroyed).toBe(true);

    await p.destroy();
  },
);

it('rejects legacy raw codec overrides explicitly and returns a clear missing-bridge error', async () => {
  const p = player();
  const rejectedStream = Readable.from([]);

  class Unsupported extends BaseExtractor {
    static override identifier = 'org.example.unsupported';

    override async stream() {
      return { stream: rejectedStream, $fmt: 'pcm' };
    }
  }

  await p.extractors.register(Unsupported);

  await expect(
    p.plugins.resolveStream(new Track({ sourceReference: { pluginId: Unsupported.identifier, data: null } })),
  ).rejects.toThrow('require migration');

  expect(rejectedStream.destroyed).toBe(true);

  await expect(p.extractors.requestBridge(new Track())).rejects.toThrow('No source plugin handled');
  await p.destroy();
});

it('restores legacy URL and query fields using the portable source reference', async () => {
  const p = player();

  class Restored extends Raw {
    override async stream(track?: Track) {
      expect(track?.raw.engine).toBe('https://example.test/audio');
      expect(track?.queryType).toBe('arbitrary');

      return Readable.from([]);
    }
  }

  await p.extractors.register(Restored);

  const source = await p.plugins.resolveStream(
    new Track({
      url: 'https://example.test/audio',
      sourceReference: { pluginId: Restored.identifier, data: { queryType: 'arbitrary' } },
    }),
  );

  if ('stream' in source) source.stream.destroy();

  await p.destroy();
});
