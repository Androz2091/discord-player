import { PassThrough, Readable } from 'stream';
import type { GuildQueue } from '../queue';
import type { ExtractorStreamable } from '../extractors/BaseExtractor';

const OUTPUT_FORMAT =
  'aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo';

export function removeTrailingCommas(input: string) {
  const result = input.replace(/^,|,$/g, '');
  return result;
}

type MediabunnyModules = readonly [
  typeof import('mediabunny'),
  typeof import('@mediabunny/server'),
  typeof import('node-av'),
];

let mediabunnyModulesPromise: Promise<MediabunnyModules> | null = null;

// Using require cause some issue with mediabunny's loader causing "loaded twice" warnings
export function importMediabunnyOrThrow(): Promise<MediabunnyModules> {
  if (!mediabunnyModulesPromise) {
    mediabunnyModulesPromise = Promise.all([
      import('mediabunny'),
      import('@mediabunny/server'),
      import('node-av'),
    ])
      .then(
        ([mediabunny, mediabunnyServer, nodeav]) =>
          [mediabunny, mediabunnyServer, nodeav] as const,
      )
      .catch((error: unknown) => {
        mediabunnyModulesPromise = null;
        throw new Error(
          'Could not find mediabunny. Ensure you have it installed by using npm i mediabunny @mediabunny/server',
          { cause: error },
        );
      });
  }

  return mediabunnyModulesPromise;
}

export type FilterChangeFunction = (filters: string) => Promise<void>;

let hasMediabunnyRegistered = false;

export async function createMediabunnyStream(
  queue: GuildQueue,
  extractedStream: ExtractorStreamable,
  seekMs = 0,
) {
  if (!queue.__isMediabunnyDecoder())
    throw new Error(
      'Attempted to call mediabunny without the option being enabled.',
    );

  const reportedBadFilters = new Set<string>();

  function reportBadFilterString(filter: string, error: unknown) {
    if (reportedBadFilters.has(filter)) return;
    reportedBadFilters.add(filter);

    // prettier-ignore
    const myDearFilterYouHaveFailed0_0ItsNotMyFaultTho = new Error(
      `FFmpeg encountered an error while applying the filter: ${filter}`,
      { cause: error }
    );

    queue.emit('error', queue, myDearFilterYouHaveFailed0_0ItsNotMyFaultTho);
  }

  const [Mediabunny, MediabunnyServer, NodeAV] =
    await importMediabunnyOrThrow();

  if (!hasMediabunnyRegistered) {
    queue.player.debug('[Mediabunny]: Registered @mediabunny/server');
    MediabunnyServer.registerMediabunnyServer();
    hasMediabunnyRegistered = true;
  }

  const {
    Input,
    ReadableStreamSource,
    ALL_FORMATS,
    AudioSampleSink,
    UrlSource,
  } = Mediabunny;

  const executionId = queue.__incrementMediabunnyExecutionId();

  // #region Decoder and filter manager
  let sourceReadable: Readable | null = null;
  let source: import('mediabunny').Source;

  if (typeof extractedStream === 'string') {
    source = new UrlSource(extractedStream);
  } else {
    sourceReadable =
      extractedStream instanceof Readable
        ? extractedStream
        : extractedStream.stream;

    const webStream = Readable.toWeb(
      sourceReadable,
    ) as ReadableStream<Uint8Array>;

    source = new ReadableStreamSource(webStream);
  }

  const input = new Input({
    source,
    formats: ALL_FORMATS,
  });

  const audioTrack = await input.getPrimaryAudioTrack();

  if (!audioTrack) {
    input.dispose();
    const audioNotFoundError = new Error('No audio tracks found. skipping ...');
    sourceReadable?.destroy(audioNotFoundError);
    throw audioNotFoundError;
  }

  const passThrough = new PassThrough({
    destroy(error, callback) {
      disposeFilterChanger();
      callback(error);
    },
  });

  const sink = new AudioSampleSink(audioTrack);

  const queueFilters = queue.filters.ffmpeg.toString().trim();

  const init = removeTrailingCommas(`${queueFilters},${OUTPUT_FORMAT}`);

  let filterApi = NodeAV.FilterAPI.create(init);

  let currentFilterString = init;
  let pendingFilterString: string | undefined;
  let isFilterChangerActive = true;
  let unregisterFilterChanger = () => { };

  function settlePendingFilterChange() {
    const resolve = pendingFilterChangeResolve;
    pendingFilterChangeResolve = null;
    resolve?.();
  }

  function disposeFilterChanger() {
    if (!isFilterChangerActive) return;
    isFilterChangerActive = false;
    unregisterFilterChanger();
    settlePendingFilterChange();
  }

  let pendingFilterChangeResolve: (() => void) | null = null;

  function changeFilter(filterString?: string) {
    if (!isFilterChangerActive) return Promise.resolve();

    const filterStringFmt = !filterString
      ? OUTPUT_FORMAT
      : `${filterString},${OUTPUT_FORMAT}`;
    if (filterStringFmt === pendingFilterString) return Promise.resolve();
    if (filterStringFmt === currentFilterString) {
      pendingFilterString = undefined;
      settlePendingFilterChange();
      return Promise.resolve();
    }

    if (queue.hasDebugger) {
      queue.debug('[Mediabunny]: Pushing filter change.');
    }

    settlePendingFilterChange();
    pendingFilterString = filterStringFmt;

    return new Promise<void>((res) => {
      const prev = pendingFilterChangeResolve;
      pendingFilterChangeResolve = () => {
        prev?.();
        res();
      };
    });
  }

  function applyPendingFilter() {
    const nextFilterString = pendingFilterString;
    if (!nextFilterString) return;
    pendingFilterString = undefined;

    try {
      // node-av loads filters lazily making it really hard to detect bad filters
      // We shouldn't have to do what we are doing in the catch statement to catch bad filter strings
      const nextFilterApi = NodeAV.FilterAPI.create(nextFilterString);

      const oldFilterApi = filterApi;
      filterApi = nextFilterApi;
      currentFilterString = nextFilterString;
      pendingFilterString = undefined;

      oldFilterApi?.close();
      if (queue.hasDebugger) {
        queue.debug('[Mediabunny]: Processed filter change.');
      }
    } catch (error) {
      reportBadFilterString(nextFilterString, error);
    } finally {
      settlePendingFilterChange();
    }
  }

  unregisterFilterChanger = queue.__setMediabunnyFilterChanger(changeFilter);

  let isNaturalEnd = true;

  const isStale = () =>
    passThrough.destroyed ||
    passThrough.writableEnded ||
    queue.__mediabunnyMetadata?.executionId !== executionId;

  function waitForDrainOrClose(): Promise<void> {
    if (passThrough.destroyed || passThrough.writableEnded)
      return Promise.resolve();

    return new Promise((resolve) => {
      const finish = () => {
        clearInterval(poll);
        passThrough.off('drain', finish);
        passThrough.off('close', finish);
        passThrough.off('error', finish);
        resolve();
      };

      const poll = setInterval(() => {
        if (isStale()) {
          isNaturalEnd = false;
          finish();
        }
      }, 250);

      passThrough.once('drain', finish);
      passThrough.once('close', finish);
      passThrough.once('error', finish);

      if (passThrough.destroyed || passThrough.writableEnded) finish();
    });
  }

  (async () => {
    const startTimestamp = Math.max(0, seekMs) / 1000;

    let bufferCache: Buffer[] = [];
    try {
      for await (const sample of sink.samples(startTimestamp)) {
        applyPendingFilter();

        if (isStale()) {
          sample.close();
          isNaturalEnd = false;
          break;
        }

        const frame = new NodeAV.Frame();
        frame.alloc();

        try {
          await MediabunnyServer.toAvFrame(sample, frame);

          for await (const processedFrame of filterApi.frames(frame)) {
            if (!processedFrame) continue;
            if (passThrough.destroyed) {
              processedFrame.unref();
              break;
            }
            try {
              const buffer = processedFrame.toBuffer();
              bufferCache.push(buffer);
            } finally {
              processedFrame.unref();
            }

            if (bufferCache.length >= 3) {
              const concatBuffer = Buffer.concat(bufferCache);
              bufferCache = [];

              const isWriteable = passThrough.write(concatBuffer);

              if (!isWriteable) {
                await waitForDrainOrClose();
                if (passThrough.destroyed) break;
              }
            }
          }
        } catch (error) {
          // node-av threw an error. Probably because of bad filters
          if (error instanceof NodeAV.FFmpegError) {
            reportBadFilterString(currentFilterString, error);
          } else {
            // if it is not a FFmpeg error, propagate the error downstream and shut it down
            throw error;
          }
        } finally {
          frame?.unref();
          sample.close();
        }
      }
    } catch (error) {
      passThrough.destroy(error as Error);
      // errored. it is not a natural end
      isNaturalEnd = false;
    } finally {
      disposeFilterChanger();

      if (
        isNaturalEnd &&
        !passThrough.destroyed &&
        !passThrough.writableEnded &&
        bufferCache.length > 0
      ) {
        passThrough.write(Buffer.concat(bufferCache));
      }
      bufferCache = [];

      if (sourceReadable && !sourceReadable.destroyed) {
        sourceReadable.destroy();
      }
      if (isNaturalEnd) {
        passThrough.end();
      } else if (!passThrough.destroyed) {
        passThrough.destroy();
      }
      if (!input.disposed) input.dispose();
      filterApi?.close();
    }
  })();

  return passThrough;
  //#endregion
}