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
  /** Playback cancellation and lifetime. */
  signal?: AbortSignal;

  /** Whether the selected node requires server-accessible locations. */
  remote?: boolean;

  /** Additional disabled source IDs. */
  blocked?: readonly string[];
}
