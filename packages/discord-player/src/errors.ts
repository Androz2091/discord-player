import { DiscordPlayerError, DiscordPlayerErrorCode } from '@discord-player/plugin-host';
export {
  DiscordPlayerError,
  DiscordPlayerErrorCode,
  IllegalHookInvocationError,
  SourceUnavailableError,
  SerializationError,
} from '@discord-player/plugin-host';

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
