import { BaseExtractor, type DiscordPlayer, type Track, definePlugin, type PluginRegistration } from '../src/index.js';

const source = definePlugin<{ path: string; enabled?: boolean }>({
  id: 'org.example.file',
  kind: 'source',
  setup(ctx) {
    const path: string = ctx.options.path;

    void path;
    // @ts-expect-error unknown option
    void ctx.options.missing;

    ctx.on('track.stream', ({ track }, { signal }) => {
      const t: Track = track;

      signal.throwIfAborted();

      return t.url;
    });

    // @ts-expect-error wrong result type
    ctx.on('track.stream', () => 42);
    // @ts-expect-error wrong input property
    ctx.on('search.query.resolve', ({ track }) => ({ tracks: [track], playlist: null }));
  },
});

const registration: PluginRegistration<{ path: string; enabled?: boolean }> = source({ path: '/audio.mp3' });

void registration;

// @ts-expect-error required options
source();

// @ts-expect-error required field
source({ enabled: true });

definePlugin<{ optional?: string }>({ id: 'optional', kind: 'source', setup() {} })();

definePlugin({ id: 'none', kind: 'source', setup() {} })();

// @ts-expect-error runtime execution is reserved
definePlugin({ id: 'runtime', kind: 'runtime', setup() {} });

class Legacy extends BaseExtractor<{ token: string }> {
  static override identifier = 'org.example.legacy';
}

export async function checkPluginTypes(player: DiscordPlayer) {
  const instance: Legacy = await player.extractors.register(Legacy, { token: 'example' });

  void instance;
  // @ts-expect-error required legacy options
  await player.extractors.register(Legacy);
  // @ts-expect-error legacy options inferred from constructor
  await player.extractors.register(Legacy, { token: 42 });
  // @ts-expect-error instances are not constructors
  await player.extractors.register(new Legacy(player.extractors, { token: 'example' }));
  // @ts-expect-error modern descriptors are not legacy constructors
  await player.extractors.register(registration);
  // @ts-expect-error modern factories are not legacy constructors
  await player.extractors.register(source);

  const result = await player.plugins.execute('search.query.resolve', { query: 'example' });
  const tracks: Track[] | undefined = result?.tracks;

  void tracks;
  // @ts-expect-error wrong operation payload
  await player.plugins.execute('track.stream', { query: 'example' });
  // @ts-expect-error undefined operation
  await player.plugins.execute('unknown', {});
}
