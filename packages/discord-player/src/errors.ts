import { DiscordPlayerError, DiscordPlayerErrorCode } from '@discord-player/plugin-host';
export * from '@discord-player/plugin-host/errors.js';

/** Error thrown when public queue insertion exceeds `maxSize`. */
export class QueueCapacityError extends DiscordPlayerError {
  /**
   * Create a queue-capacity error.
   * @param count Number of Tracks in the attempted insertion.
   * @param capacity Remaining public queue capacity.
   */
  public constructor(
    /** Number of Tracks in the attempted insertion. */
    count: number,
    /** Remaining public queue capacity. */
    capacity: number,
  ) {
    super(
      `Adding ${count} track(s) exceeds this queue's remaining capacity of ${capacity}.`,
      DiscordPlayerErrorCode.QueueCapacity,
    );
  }
}

/** Error thrown when an API is waiting for an upstream Remedia capability. */
export class UnsupportedRemediaCapabilityError extends DiscordPlayerError {
  /**
   * Create an unsupported-capability error naming the required API.
   * @param capability Remedia method or behavior required by the operation.
   */
  public constructor(
    /** Remedia method or behavior required by the operation. */
    capability: string,
  ) {
    super(
      `This operation requires the Remedia ${capability} API, which is not available in the installed client.`,
      DiscordPlayerErrorCode.UnsupportedRemediaCapability,
    );
  }
}

/** Error thrown when a navigation or lookup operation has no matching result. */
export class NoResultError extends DiscordPlayerError {
  /**
   * Create a no-result error.
   * @param message Description of the missing result.
   */
  public constructor(
    /** Description of the missing result. */
    message: string,
  ) {
    super(message, DiscordPlayerErrorCode.NoResult);
  }
}
