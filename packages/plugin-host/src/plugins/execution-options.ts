import type { MediaSource } from '@remedia/client';
/** Optional dispatch targeting and cancellation. */
export interface ExecuteOptions {
  /** Restrict execution to one provider. */
  pluginId?: string;

  /** Caller cancellation. */
  signal?: AbortSignal;

  /** Disabled source IDs. */
  blocked?: readonly string[];
}

/** Playback resolution configuration selected after the Remedia session is connected. */
export interface StreamResolutionOptions {
  /** Restrict eager transport resolution to a declared URL-only source; defer bridging and byte transforms.
   * @internal
   */
  directUrlOnly?: boolean;

  /** Materialize encoded media inside a transport adapter before post-stream processing.
   * @param source Resolved media descriptor.
   * @param signal Combined caller and provider lifetime.
   * @returns A source owned by this resolution call.
   */
  prepareSource?: (source: MediaSource, signal?: AbortSignal) => Promise<MediaSource>;

  /** Playback cancellation and lifetime. */
  signal?: AbortSignal;

  /** Whether the selected node requires server-accessible locations. */
  remote?: boolean;

  /** Additional disabled source IDs. */
  blocked?: readonly string[];
}
