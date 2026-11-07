import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscordPlayer, NoResultError } from '../src/index.js';
import { mockFetch, jsonResponse } from './mocks/http.js';
import { deferred } from './mocks/async.js';
import { settle } from './mocks/async.js';

const makeLyrics = () => new DiscordPlayer({ nodes: [], send() {} }).lyrics;
afterEach(() => vi.useRealTimers());

describe('serialized lyrics requests', () => {
  it('validates configuration and encodes lookup/search parameters and headers', async () => {
    const lyrics = makeLyrics();
    const fetch = mockFetch().mockImplementation(async () => jsonResponse({ id: 1 }));
    for (const timeout of [0, -1, NaN, Infinity]) expect(() => lyrics.setRequestTimeout(timeout)).toThrow(RangeError);
    for (const limit of [-1, 0.5, NaN]) expect(() => lyrics.setRetryLimit(limit)).toThrow(RangeError);
    lyrics.setRequestTimeout(1000);
    lyrics.setRetryLimit(0);
    expect(() => lyrics.search({})).toThrow(TypeError);
    await lyrics.get({ trackName: 'Title & words', artistName: 'Artist', albumName: '', duration: 60 });
    expect(String(fetch.mock.calls[0]![0])).toContain('track_name=Title+%26+words&artist_name=Artist&duration=60');
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('Discord-Player/'),
      'Content-Type': 'application/json',
    });
    await lyrics.getById(2);
    await lyrics.getCached({ trackName: 'Title' });
    await lyrics.search({ q: 'query' });
    await lyrics.search({ trackName: 'Title' });
    const signal = new AbortController().signal;
    await lyrics.request('/custom', { method: 'POST', signal, headers: { 'X-Test': 'yes' } });
    expect(fetch.mock.calls.at(-1)![1]).toMatchObject({ method: 'POST', signal, headers: { 'X-Test': 'yes' } });
    expect(fetch.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/get/2'),
        expect.stringContaining('/get-cached?'),
        expect.stringContaining('/search?'),
        expect.stringContaining('/custom'),
      ]),
    );
  });

  it('serializes concurrent requests and releases its turn after success and failure', async () => {
    const lyrics = makeLyrics();
    const fetch = mockFetch();
    const first = deferred<Response>();
    fetch
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(jsonResponse({ id: 2 }))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ id: 4 }));
    const one = lyrics.getById(1);
    const two = lyrics.getById(2);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    first.resolve(jsonResponse({ id: 1 }));
    expect(await one).toEqual({ id: 1 });
    expect(await two).toEqual({ id: 2 });
    await expect(lyrics.getById(3)).rejects.toThrow('network down');
    expect(await lyrics.getById(4)).toEqual({ id: 4 });
  });

  it('retries rate limits with Retry-After and server errors with exponential backoff', async () => {
    vi.useFakeTimers();
    const lyrics = makeLyrics();
    lyrics.setRetryLimit(2);
    const fetch = mockFetch()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));
    const request = lyrics.getById(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(await request).toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects permanent failures and exhausted retries without blocking later requests', async () => {
    vi.useFakeTimers();
    const lyrics = makeLyrics();
    lyrics.setRetryLimit(1);
    const fetch = mockFetch()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ id: 4 }));
    const failed = expect(lyrics.getById(1)).rejects.toBeInstanceOf(NoResultError);
    await vi.advanceTimersByTimeAsync(250);
    await failed;
    await expect(lyrics.getById(2)).rejects.toThrow('404');
    expect(await lyrics.getById(4)).toEqual({ id: 4 });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('propagates JSON parse failures and caller cancellation', async () => {
    const lyrics = makeLyrics();
    const fetch = mockFetch()
      .mockResolvedValueOnce(new Response('malformed'))
      .mockImplementationOnce(async (_, options) => {
        options?.signal?.throwIfAborted();
        return jsonResponse({});
      });
    await expect(lyrics.getById(1)).rejects.toBeInstanceOf(SyntaxError);
    await expect(lyrics.request('cancelled', { signal: AbortSignal.abort('cancel') })).rejects.toBe('cancel');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
