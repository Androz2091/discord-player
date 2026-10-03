import { PassThrough, Readable } from "stream";
import type { GuildQueue, OnStreamExtractedHandler } from "../queue";
import { StreamType } from "discord-voip";

const OUTPUT_FORMAT = "aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo";

export function removeTrailingCommas(input: string) {
    const result = input.replace(/^,|,$|/g, "");

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

/**
 * Create a Mediabunny based stream decoder while respecting original stream modifiers.
 */
export function createMediabunnyDecoder(queue: GuildQueue): OnStreamExtractedHandler {
    const originalStreamExtractedHandler = queue.onStreamExtracted.bind(queue);
    let currentExecutionId = 0;

    return async (stream, track) => {
        const extractedStream = await originalStreamExtractedHandler(stream, track, queue);

        if (!queue.__isMediabunnyDecoder()) {
            queue.player.debug("[Mediabunny]: Attempted to call mediabunny's stream extraction engine without being enabled. Returning to default behavior.");
            return extractedStream;
        }

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
            AudioSample
        } = Mediabunny;

        currentExecutionId++;
        const executionId = structuredClone(currentExecutionId);

        // #region Decoder and filter manager
        let webStream: ReadableStream<Uint8Array>;
        let abortController: AbortController | null = null;
        let sourceReadable: Readable | null = null;

        if (typeof extractedStream === "string") {
            abortController = new AbortController();
            const response = await fetch(extractedStream, {
                signal: abortController.signal
            });
            if (!response.ok || !response.body) {
                queue.player.debug(`[Mediabunny Decoder]: Failed to fetch web stream using fetch. Status code ${response.status}`);

                return extractedStream;
            }

            webStream = response.body;
        } else {
            sourceReadable = extractedStream instanceof Readable ? extractedStream : extractedStream.stream;

            webStream = Readable.toWeb(sourceReadable) as typeof webStream;
        }

        const input = new Input({
            source: new ReadableStreamSource(webStream),
            formats: ALL_FORMATS
        });

        const audioTrack = await input.getPrimaryAudioTrack();

        if (!audioTrack) {
            queue.player.debug("[Mediabunny]: Could not find any audio tracks inside given stream. Falling back to default behavior");
            return extractedStream;
        }

        const passThrough = new PassThrough({
            destroy(error, callback) {
                abortController?.abort();
                callback(error);
            }
        });

        const sink = new AudioSampleSink(audioTrack);

        const initialFilters: string[] = [];

        const filters = queue.filters.ffmpeg.toString();
        if (!filters || filters.trim() !== "") {
            initialFilters.push(queue.filters.ffmpeg.toString());
        }
        initialFilters.push(OUTPUT_FORMAT);

        const init = removeTrailingCommas(initialFilters.join(","));

        let filterApi = NodeAV.FilterAPI.create(init);

        let currentFilterString = init;

        function changeFilter(filterString?: string) {
            const filterStringFmt = removeTrailingCommas(
                !filterString || filterString.trim() === "" ?
                    OUTPUT_FORMAT :
                    `${filterString},${OUTPUT_FORMAT}`
            );
            if (currentFilterString === filterStringFmt) return;
            const old = filterApi;
            currentFilterString = filterStringFmt;
            filterApi = NodeAV.FilterAPI.create(filterStringFmt);

            setTimeout(() => {
                old?.close();
            }, 200);
        }

        queue.__setMediabunnyFilterChanger(changeFilter);

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
            let bufferCache: Buffer[] = [];
            try {
                for await (const sample of sink.samples()) {
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
                if (bufferCache.length > 0) {
                    const concatBuffer = Buffer.concat(bufferCache);
                    bufferCache = [];
                    passThrough.write(concatBuffer);
                }
                abortController?.abort();
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

        return {
            stream: passThrough,
            $fmt: StreamType.Raw
        };
        //#endregion
    };
}