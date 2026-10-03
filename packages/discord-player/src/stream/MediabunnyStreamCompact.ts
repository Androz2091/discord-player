import { PassThrough, Readable } from "stream";
import type { GuildQueue } from "../queue";
import type { ExtractorStreamable } from "../extractors/BaseExtractor";

const OUTPUT_FORMAT = "aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo";

export function removeTrailingCommas(input: string) {
    const result = input.replace(/^,|,$/g, "");
    return result;
}

type MediabunnyModules = readonly [
    typeof import("mediabunny"),
    typeof import("@mediabunny/server"),
    typeof import("node-av")
];

let mediabunnyModulesPromise: Promise<MediabunnyModules> | null = null;

// Using require cause some issue with mediabunny's loader causing "loaded twice" warnings
export function importMediabunnyOrThrow(): Promise<MediabunnyModules> {
    if (!mediabunnyModulesPromise) {
        mediabunnyModulesPromise = Promise.all([
            import("mediabunny"),
            import("@mediabunny/server"),
            import("node-av")
        ]).then(([mediabunny, mediabunnyServer, nodeav]) =>
            [mediabunny, mediabunnyServer, nodeav] as const
        ).catch((error: unknown) => {
            mediabunnyModulesPromise = null;
            throw new Error(
                "Could not find mediabunny. Ensure you have it installed by using npm i mediabunny @mediabunny/server",
                { cause: error }
            );
        });
    }

    return mediabunnyModulesPromise;
}

export type FilterChangeFunction = (filters: string) => void;

let hasMediabunnyRegistered = false;

export async function createMediabunnyStream(queue: GuildQueue, extractedStream: ExtractorStreamable, seekMs = 0) {
    if (!queue.__isMediabunnyDecoder()) throw new Error("Attempted to call mediabunny without the option being enabled.");

    const currentExecutionId = queue.__incrementMediabunnyExecutionId();

    const [Mediabunny, MediabunnyServer, NodeAV] = await importMediabunnyOrThrow();

    if (!hasMediabunnyRegistered) {
        queue.player.debug("[Mediabunny]: Registered @mediabunny/server");
        MediabunnyServer.registerMediabunnyServer();
        hasMediabunnyRegistered = true;
    }

    const {
        Input,
        ReadableStreamSource,
        ALL_FORMATS,
        AudioSampleSink,
        AudioSample,
        UrlSource
    } = Mediabunny;

    const executionId = currentExecutionId;

    // #region Decoder and filter manager
    let sourceReadable: Readable | null = null;
    let source: import("mediabunny").Source;

    if (typeof extractedStream === "string") {
        source = new UrlSource(extractedStream);
    } else {
        sourceReadable = extractedStream instanceof Readable ? extractedStream : extractedStream.stream;

        const webStream = Readable.toWeb(sourceReadable) as ReadableStream<Uint8Array>;

        source = new ReadableStreamSource(webStream);
    }

    const input = new Input({
        source,
        formats: ALL_FORMATS
    });

    const audioTrack = await input.getPrimaryAudioTrack();

    if (!audioTrack) {
        throw new Error("No audio tracks found. skipping ...");
    }

    const passThrough = new PassThrough({
        destroy(error, callback) {
            disposeFilterChanger();
            callback(error);
        }
    });

    const sink = new AudioSampleSink(audioTrack);

    const init = removeTrailingCommas(`${queue.filters.ffmpeg.toString().trim()},${OUTPUT_FORMAT}`);

    let filterApi = NodeAV.FilterAPI.create(init);

    let currentFilterString = init;
    let pendingFilterString: string | undefined;
    let isFilterChangerActive = true;
    let unregisterFilterChanger = () => { };

    function disposeFilterChanger() {
        if (!isFilterChangerActive) return;
        isFilterChangerActive = false;
        unregisterFilterChanger();
    }

    function changeFilter(filterString?: string) {
        if (!isFilterChangerActive) return;

        const filterStringFmt = !filterString ?
            OUTPUT_FORMAT :
            `${filterString},${OUTPUT_FORMAT}`;
        if (filterStringFmt === pendingFilterString) return;
        if (filterStringFmt === currentFilterString) {
            pendingFilterString = undefined;
            return;
        }
        if (queue.hasDebugger) {
            queue.debug("[Mediabunny]: Pushing filter change.");
        }
        pendingFilterString = filterStringFmt;
    }

    function applyPendingFilter() {
        const nextFilterString = pendingFilterString;
        if (!nextFilterString) return;

        const nextFilterApi = NodeAV.FilterAPI.create(nextFilterString);

        if (queue.hasDebugger) {
            queue.debug("[Mediabunny]: Processed filter change.");
        }

        const oldFilterApi = filterApi;
        filterApi = nextFilterApi;
        currentFilterString = nextFilterString;
        pendingFilterString = undefined;

        oldFilterApi?.close();
    }

    unregisterFilterChanger = queue.__setMediabunnyFilterChanger(changeFilter);

    let isNaturalEnd = true;

    function waitForDrainOrClose(): Promise<void> {
        if (passThrough.destroyed || passThrough.writableEnded) return Promise.resolve();

        const isStale = () =>
            passThrough.destroyed ||
            passThrough.writableEnded ||
            currentExecutionId !== executionId;

        return new Promise((resolve) => {
            const finish = () => {
                clearInterval(poll);
                passThrough.off("drain", finish);
                passThrough.off("close", finish);
                passThrough.off("error", finish);
                resolve();
            };

            const poll = setInterval(() => {
                if (isStale()) {
                    isNaturalEnd = false;
                    finish();
                }
            }, 250);

            passThrough.once("drain", finish);
            passThrough.once("close", finish);
            passThrough.once("error", finish);

            if (passThrough.destroyed || passThrough.writableEnded) finish();
        });
    }

    (async () => {
        const startTimestamp = Math.max(0, seekMs) / 1000;

        let bufferCache: Buffer[] = [];
        try {
            for await (const sample of sink.samples(startTimestamp)) {
                applyPendingFilter();

                if (passThrough.destroyed) {
                    sample.close();
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
                        const mSample = new AudioSample(new MediabunnyServer.AvFrameAudioSampleResource(processedFrame));
                        let finalBuffer: Buffer;
                        try {
                            const pcmBuffer = new Int16Array(mSample.numberOfFrames * mSample.numberOfChannels);
                            mSample.copyTo(pcmBuffer, {
                                planeIndex: 0,
                                format: "s16"
                            });
                            finalBuffer = Buffer.from(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength);
                        } finally {
                            mSample.close();
                        }

                        bufferCache.push(finalBuffer);

                        if (bufferCache.length >= 3) {
                            const concatBuffer = Buffer.concat(bufferCache);
                            bufferCache = [];

                            const isWriteable = passThrough.write(
                                concatBuffer
                            );

                            if (!isWriteable) {
                                await waitForDrainOrClose();
                                if (passThrough.destroyed) break;
                            }
                        }
                    }
                } catch {
                    // no-op throw away the frame
                } finally {
                    frame?.unref();
                    sample.close();
                }
            }
        } catch (error) {
            passThrough.destroy(error as Error);
        } finally {
            disposeFilterChanger();
            if (bufferCache.length > 0) {
                const concatBuffer = Buffer.concat(bufferCache);
                bufferCache = [];
                passThrough.write(concatBuffer);
            }
            if (sourceReadable && !sourceReadable.destroyed) {
                sourceReadable.destroy();
            }
            if (isNaturalEnd) {
                passThrough.end();
            } else if (!passThrough.destroyed) {
                passThrough.destroy();
            }
            if (!input.disposed) {
                input.dispose();
            }
            filterApi?.close();
        }
    })();

    return passThrough;
    //#endregion
}

/**
 * Create a Mediabunny based stream decoder while respecting original stream modifiers.
 */
// export function createMediabunnyDecoder(queue: GuildQueue): OnStreamExtractedHandler {
//     const originalStreamExtractedHandler = queue.onStreamExtracted.bind(queue);
//     let currentExecutionId = 0;

//     return async (stream, track) => {
//         const extractedStream = await originalStreamExtractedHandler(stream, track, queue);

//         if (!queue.__isMediabunnyDecoder()) {
//             queue.player.debug("[Mediabunny]: Attempted to call mediabunny's stream extraction engine without being enabled. Returning to default behavior.");
//             return extractedStream;
//         }

//         const [Mediabunny, MediabunnyServer, NodeAV] = await importMediabunnyOrThrow();

//         if (!hasMediabunnyRegistered) {
//             queue.player.debug("[Mediabunny]: Registered @mediabunny/server");
//             MediabunnyServer.registerMediabunnyServer();
//             hasMediabunnyRegistered = true;
//         }

//         const {
//             Input,
//             ReadableStreamSource,
//             ALL_FORMATS,
//             AudioSampleSink,
//             AudioSample
//         } = Mediabunny;

//         currentExecutionId++;
//         const executionId = currentExecutionId;

//         // #region Decoder and filter manager
//         let webStream: ReadableStream<Uint8Array>;
//         let abortController: AbortController | null = null;
//         let sourceReadable: Readable | null = null;

//         if (typeof extractedStream === "string") {
//             abortController = new AbortController();
//             const response = await fetch(extractedStream, {
//                 signal: abortController.signal
//             });
//             if (!response.ok || !response.body) {
//                 queue.player.debug(`[Mediabunny Decoder]: Failed to fetch web stream using fetch. Status code ${response.status}`);

//                 return extractedStream;
//             }

//             webStream = response.body;
//         } else {
//             sourceReadable = extractedStream instanceof Readable ? extractedStream : extractedStream.stream;

//             webStream = Readable.toWeb(sourceReadable) as typeof webStream;
//         }

//         const input = new Input({
//             source: new ReadableStreamSource(webStream),
//             formats: ALL_FORMATS
//         });

//         const audioTrack = await input.getPrimaryAudioTrack();

//         if (!audioTrack) {
//             queue.player.debug("[Mediabunny]: Could not find any audio tracks inside given stream. Falling back to default behavior");
//             return extractedStream;
//         }

//         const passThrough = new PassThrough({
//             destroy(error, callback) {
//                 abortController?.abort();
//                 disposeFilterChanger();
//                 callback(error);
//             }
//         });

//         const sink = new AudioSampleSink(audioTrack);

//         const initialFilters: string[] = [];

//         const filters = queue.filters.ffmpeg.toString();
//         if (!filters.trim()) {
//             initialFilters.push(queue.filters.ffmpeg.toString());
//         }
//         initialFilters.push(OUTPUT_FORMAT);

//         const init = removeTrailingCommas(initialFilters.join(","));

//         let filterApi = NodeAV.FilterAPI.create(init);

//         let currentFilterString = init;
//         let pendingFilterString: string | undefined;
//         let isFilterChangerActive = true;
//         let unregisterFilterChanger = () => { };

//         function disposeFilterChanger() {
//             if (!isFilterChangerActive) return;
//             isFilterChangerActive = false;
//             unregisterFilterChanger();
//         }

//         function changeFilter(filterString?: string) {
//             if (!isFilterChangerActive) return;

//             const filterStringFmt = !filterString ?
//                 OUTPUT_FORMAT :
//                 `${filterString},${OUTPUT_FORMAT}`;
//             if (filterStringFmt === pendingFilterString) return;
//             if (filterStringFmt === currentFilterString) {
//                 pendingFilterString = undefined;
//                 return;
//             }
//             pendingFilterString = filterStringFmt;
//         };

//         function applyPendingFilter() {
//             const nextFilterString = pendingFilterString;
//             if (!nextFilterString) return;

//             const nextFilterApi = NodeAV.FilterAPI.create(nextFilterString);
//             const oldFilterApi = filterApi;
//             filterApi = nextFilterApi;
//             currentFilterString = nextFilterString;
//             pendingFilterString = undefined;

//             oldFilterApi?.close();
//         }

//         unregisterFilterChanger = queue.__setMediabunnyFilterChanger(changeFilter);

//         let isNaturalEnd = true;

//         function waitForDrainOrClose(): Promise<void> {
//             if (passThrough.destroyed || passThrough.writableEnded) return Promise.resolve();

//             const isStale = () =>
//                 passThrough.destroyed ||
//                 passThrough.writableEnded ||
//                 currentExecutionId !== executionId;

//             return new Promise((resolve) => {
//                 const finish = () => {
//                     clearInterval(poll);
//                     passThrough.off("drain", finish);
//                     passThrough.off("close", finish);
//                     passThrough.off("error", finish);
//                     resolve();
//                 };

//                 const poll = setInterval(() => {
//                     if (isStale()) {
//                         isNaturalEnd = false;
//                         finish();
//                     }
//                 }, 250);

//                 passThrough.once("drain", finish);
//                 passThrough.once("close", finish);
//                 passThrough.once("error", finish);

//                 if (passThrough.destroyed || passThrough.writableEnded) finish();
//             });
//         }

//         (async () => {
//             let bufferCache: Buffer[] = [];
//             try {
//                 for await (const sample of sink.samples()) {
//                     applyPendingFilter();

//                     if (passThrough.destroyed) {
//                         sample.close();
//                         break;
//                     }

//                     const frame = new NodeAV.Frame();
//                     frame.alloc();

//                     try {
//                         await MediabunnyServer.toAvFrame(sample, frame);

//                         for await (const processedFrame of filterApi.frames(frame)) {
//                             if (!processedFrame) continue;
//                             if (passThrough.destroyed) {
//                                 processedFrame.unref();
//                                 break;
//                             }
//                             const mSample = new AudioSample(new MediabunnyServer.AvFrameAudioSampleResource(processedFrame));
//                             let finalBuffer: Buffer;
//                             try {
//                                 const pcmBuffer = new Int16Array(mSample.numberOfFrames * mSample.numberOfChannels);
//                                 mSample.copyTo(pcmBuffer, {
//                                     planeIndex: 0,
//                                     format: "s16"
//                                 });
//                                 finalBuffer = Buffer.from(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength);
//                             } finally {
//                                 mSample.close();
//                             }

//                             bufferCache.push(finalBuffer);

//                             if (bufferCache.length >= 3) {
//                                 const concatBuffer = Buffer.concat(bufferCache);
//                                 bufferCache = [];

//                                 const isWriteable = passThrough.write(
//                                     concatBuffer
//                                 );

//                                 if (!isWriteable) {
//                                     await waitForDrainOrClose();
//                                     if (passThrough.destroyed) break;
//                                 }
//                             }
//                         }
//                     } catch {
//                         // no-op throw away the frame
//                     } finally {
//                         frame?.unref();
//                         sample.close();
//                     }
//                 }
//             } catch (error) {
//                 passThrough.destroy(error as Error);
//             } finally {
//                 disposeFilterChanger();
//                 if (bufferCache.length > 0) {
//                     const concatBuffer = Buffer.concat(bufferCache);
//                     bufferCache = [];
//                     passThrough.write(concatBuffer);
//                 }
//                 abortController?.abort();
//                 if (sourceReadable && !sourceReadable.destroyed) {
//                     sourceReadable.destroy();
//                 }
//                 if (isNaturalEnd) {
//                     passThrough.end();
//                 } else if (!passThrough.destroyed) {
//                     passThrough.destroy();
//                 }
//                 if (!input.disposed) {
//                     input.dispose();
//                 }
//                 filterApi?.close();
//             }
//         })();

//         return {
//             stream: passThrough,
//             $fmt: StreamType.Raw
//         };
//         //#endregion
//     };
// }