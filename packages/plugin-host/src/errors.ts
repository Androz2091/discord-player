/** Public error codes for Discord Player's application-level failures. */
export const DiscordPlayerErrorCode = {
  /** Queue insertion exceeded the configured capacity. */
  QueueCapacity: 'ERR_QUEUE_CAPACITY',
  /** A required queue, session, or track could not be resolved. */
  NoResult: 'ERR_NO_RESULT',
  /** The installed Remedia client does not provide a requested capability. */
  UnsupportedRemediaCapability: 'ERR_UNSUPPORTED_REMEDIA_CAPABILITY',
  /** A track has no source plugin to resolve a Remedia source. */
  SourceUnavailable: 'ERR_SOURCE_UNAVAILABLE',
  /** Data could not be serialized or reconstructed. */
  Serialization: 'ERR_SERIALIZATION',
} as const;

/** Error code union for Discord Player errors. */
export type DiscordPlayerErrorCode = (typeof DiscordPlayerErrorCode)[keyof typeof DiscordPlayerErrorCode];

/** Base error carrying a stable Discord Player error code. */
export class DiscordPlayerError extends Error {
  /** Stable machine-readable error code. */
  public readonly code: DiscordPlayerErrorCode;

  /**
   * Create an error with an explicit code and optional cause.
   * @param message Human-readable explanation.
   * @param code Stable machine-readable code.
   * @param options Original error or failure value.
   */
  public constructor(
    /** Human-readable explanation. */
    message: string,
    /** Stable machine-readable code. */
    code: DiscordPlayerErrorCode,
    /** Original error or failure value. */
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Error thrown when a Track has no source plugin able to produce a Remedia source. */
export class SourceUnavailableError extends DiscordPlayerError {
  /**
   * Create an unresolved Track source error.
   * @param track Track title or identifier that could not be resolved.
   */
  public constructor(
    /** Track title or identifier that could not be resolved. */
    track: string,
  ) {
    super(`No source plugin is available to resolve Track "${track}".`, DiscordPlayerErrorCode.SourceUnavailable);
  }
}

/** Error thrown when a serialization input cannot be encoded or decoded. */
export class SerializationError extends DiscordPlayerError {
  /**
   * Create a serialization error with an optional original cause.
   * @param message Human-readable serialization failure.
   * @param options Original error or failure value.
   */
  public constructor(
    /** Human-readable serialization failure. */
    message = 'Could not serialize or deserialize the provided data.',
    /** Original error or failure value. */
    options?: ErrorOptions,
  ) {
    super(message, DiscordPlayerErrorCode.Serialization, options);
  }
}
