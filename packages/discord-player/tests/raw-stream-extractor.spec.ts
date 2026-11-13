import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { it, expect } from 'vitest';
import { DiscordPlayer, QueryType } from '../src/index.js';
import { RawStreamExtractor } from './fixtures/raw-stream-extractor.js';

it('runs a mock raw URL and local encoded-file extractor through the source host offline', async () => {
  const player = new DiscordPlayer({ nodes: [], send() {} });

  await player.extractors.register(RawStreamExtractor);

  const result = await player.search('https://example.test/audio.mp3');
  const track = result.tracks[0]!;

  expect(track.extractor).toBeInstanceOf(RawStreamExtractor);
  expect(track.raw.engine).toBe(track.url);
  expect(await track.requestMetadata()).toMatchObject({ url: track.url });
  expect(await player.plugins.resolveStream(track, { remote: true })).toEqual({ url: track.url });

  const directory = await mkdtemp(path.join(tmpdir(), 'dp-source-'));

  try {
    const file = path.join(directory, 'encoded.mp3');

    await writeFile(file, Buffer.from('offline encoded fixture'));

    const local = (await player.search(file, { searchEngine: QueryType.FILE })).tracks[0]!;

    expect(local.raw.isFile).toBe(true);

    const source = await player.plugins.resolveStream(local);

    expect('stream' in source && source.stream).toBeInstanceOf(Readable);

    if (!('stream' in source)) throw new Error('Expected encoded fixture stream');

    const chunks: Buffer[] = [];

    for await (const chunk of source.stream) chunks.push(Buffer.from(chunk));

    expect(Buffer.concat(chunks).toString()).toBe('offline encoded fixture');

    await expect(player.plugins.resolveStream(local, { remote: true })).rejects.toThrow('server-accessible');
  } finally {
    await player.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
