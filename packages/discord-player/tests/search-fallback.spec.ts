import { afterEach, expect, it, vi } from 'vitest';
import { DiscordPlayer, PluginError, Track, definePlugin } from '../src/index.js';
import {
  BrokenMatchingExtractor,
  exhaustedUrl,
  MatchingExtractor,
  PermissiveExtractor,
  matchingUrl,
} from './mocks/search-fallback.js';

const players: DiscordPlayer[] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

function createPlayer() {
  const player = new DiscordPlayer({ nodes: [], send() {} });

  players.push(player);

  return player;
}

it('falls through a permissive legacy extractor to the matching provider', async () => {
  const player = createPlayer();

  await player.extractors.register(PermissiveExtractor);
  await player.extractors.register(MatchingExtractor);

  const permissive = player.extractors.get(PermissiveExtractor.identifier)!;
  const matching = player.extractors.get(MatchingExtractor.identifier)!;
  const resolvePermissive = vi.spyOn(permissive, 'handle');
  const resolveMatching = vi.spyOn(matching, 'handle');
  const result = await player.search(matchingUrl);

  expect(result.tracks).toHaveLength(1);
  expect(result.tracks[0]).toMatchObject({ title: 'Matching provider result', url: matchingUrl });
  expect(resolvePermissive).toHaveBeenCalledOnce();
  expect(resolveMatching).toHaveBeenCalledOnce();
});

it('preserves priority and match-score ordering while trying failed candidates', async () => {
  const player = createPlayer();
  const attempts: string[] = [];

  for (const candidate of [
    { id: 'low-score', priority: 5, score: 1, succeeds: false },
    { id: 'high-score', priority: 5, score: 100, succeeds: false },
    { id: 'lower-priority', priority: 4, score: 1000, succeeds: true },
  ]) {
    await player.plugins.register(
      definePlugin({
        id: candidate.id,

        setup(ctx) {
          ctx.on('search.query.match', () => ({ score: candidate.score }), { priority: candidate.priority });
          ctx.on(
            'search.query.resolve',
            () => {
              attempts.push(candidate.id);

              if (!candidate.succeeds) throw new Error(`${candidate.id} could not resolve`);

              return { tracks: [new Track({ title: candidate.id })], playlist: null };
            },
            { priority: candidate.priority },
          );
        },
      })(),
    );
  }

  const result = await player.search('query');

  expect(attempts).toEqual(['high-score', 'low-score', 'lower-priority']);
  expect(result.tracks[0]?.title).toBe('lower-priority');
});

it('keeps explicitly targeted search failures strict', async () => {
  const player = createPlayer();

  await player.extractors.register(PermissiveExtractor);
  await player.extractors.register(MatchingExtractor);

  const matching = player.extractors.get(MatchingExtractor.identifier)!;
  const resolveMatching = vi.spyOn(matching, 'handle');
  const error = await player.search(matchingUrl, { searchEngine: PermissiveExtractor.identifier }).then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(PluginError);
  expect(error).toMatchObject({
    pluginId: PermissiveExtractor.identifier,
    operation: 'search.query.resolve',
  });
  expect(resolveMatching).not.toHaveBeenCalled();
});

it('returns useful provider-attributed errors after all matching candidates fail', async () => {
  const player = createPlayer();

  await player.extractors.register(PermissiveExtractor);
  await player.extractors.register(BrokenMatchingExtractor);

  const error = await player.search(exhaustedUrl).then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(AggregateError);
  expect(error).toMatchObject({
    message: expect.stringContaining(PermissiveExtractor.identifier),
  });
  expect((error as AggregateError).message).toContain(BrokenMatchingExtractor.identifier);
  expect((error as AggregateError).errors).toEqual([
    expect.objectContaining({ pluginId: PermissiveExtractor.identifier }),
    expect.objectContaining({ pluginId: BrokenMatchingExtractor.identifier }),
  ]);
});

it('returns empty results when providers do not match or all matching providers decline', async () => {
  const noMatches = createPlayer();

  expect((await noMatches.search(matchingUrl)).isEmpty()).toBe(true);

  const declines = createPlayer();
  const declined: string[] = [];

  for (const id of ['fixture.declining-provider-a', 'fixture.declining-provider-b']) {
    await declines.plugins.register(
      definePlugin({
        id,

        setup(ctx) {
          ctx.on('search.query.match', () => ({ score: 1 }));
          ctx.on('search.query.resolve', () => {
            declined.push(id);

            return { tracks: [], playlist: null };
          });
        },
      })(),
    );
  }

  expect((await declines.search(matchingUrl)).isEmpty()).toBe(true);
  expect(declined).toEqual(['fixture.declining-provider-a', 'fixture.declining-provider-b']);
});

it('propagates cancellation immediately without trying another search candidate', async () => {
  const player = createPlayer();
  let enterResolve!: () => void;
  const entered = new Promise<void>((resolve) => {
    enterResolve = resolve;
  });
  const fallbackResolve = vi.fn(() => ({ tracks: [new Track({ title: 'unexpected' })], playlist: null }));

  await player.plugins.register(
    definePlugin({
      id: 'fixture.pending-provider',

      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 2 }));
        ctx.on('search.query.resolve', async (_, { signal }) => {
          enterResolve();

          await new Promise<void>((_resolve, reject) => {
            const rejectOnAbort = () => reject(signal.reason);

            if (signal.aborted) {
              rejectOnAbort();
              return;
            }

            signal.addEventListener('abort', rejectOnAbort, { once: true });
          });

          return { tracks: [], playlist: null };
        });
      },
    })(),
  );
  await player.plugins.register(
    definePlugin({
      id: 'fixture.never-reached',

      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 1 }));
        ctx.on('search.query.resolve', fallbackResolve);
      },
    })(),
  );

  const controller = new AbortController();
  const search = player.search('query', { signal: controller.signal });

  await entered;
  controller.abort(new Error('search cancelled'));

  await expect(search).rejects.toThrow('search cancelled');
  expect(fallbackResolve).not.toHaveBeenCalled();
});
