export class DiscordPlayerError extends Error {
  public readonly code: ErrorCodes;
  public readonly timestamp: number = Date.now();

  public constructor(code: ErrorCodes, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON() {
    return {
      name: this.constructor.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}

export class OutOfSpaceError extends DiscordPlayerError {
  constructor(target: string, capacity: number, total: number) {
    super(
      ErrorCodes.ERR_OUT_OF_SPACE,
      `Max capacity reached for ${target} (Capacity ${capacity}/Total ${total})`,
    );
  }
}

export class InvalidArgTypeError extends DiscordPlayerError {
  constructor(target: string, expectation: string, found: string) {
    super(
      ErrorCodes.ERR_INVALID_ARG_TYPE,
      `Expected ${target} to be "${expectation}", received "${found}"`,
    );
  }
}

export class NoResultError extends DiscordPlayerError {
  constructor(message: string) {
    super(ErrorCodes.ERR_NO_RESULT, message);
  }
}

export class NotImplementedError extends DiscordPlayerError {
  constructor(target: string) {
    super(ErrorCodes.ERR_NOT_IMPLEMENTED, `${target} is not yet implemented`);
  }
}

export class NotExistingError extends DiscordPlayerError {
  constructor(target: string) {
    super(ErrorCodes.ERR_NOT_EXISTING, `${target} does not exist`);
  }
}

export class OutOfRangeError extends DiscordPlayerError {
  constructor(target: string, value: string, minimum: string, maximum: string) {
    super(
      ErrorCodes.ERR_OUT_OF_RANGE,
      `${target} is out of range (Expected minimum ${minimum} and maximum ${maximum}, got ${value})`,
    );
  }
}

export class NoVoiceConnectionError extends DiscordPlayerError {
  constructor(message?: string) {
    super(
      ErrorCodes.ERR_NO_VOICE_CONNECTION,
      message ||
        'No voice connection available, maybe connect to a voice channel first?',
    );
  }
}

export class VoiceConnectionDestroyedError extends DiscordPlayerError {
  constructor() {
    super(
      ErrorCodes.ERR_VOICE_CONNECTION_DESTROYED,
      'Cannot use destroyed voice connection',
    );
  }
}

export class NoVoiceChannelError extends DiscordPlayerError {
  constructor() {
    super(ErrorCodes.ERR_NO_VOICE_CHANNEL, 'Could not get the voice channel');
  }
}

export class InvalidVoiceChannelError extends DiscordPlayerError {
  constructor() {
    super(ErrorCodes.ERR_INVALID_VOICE_CHANNEL, 'Expected a voice channel');
  }
}

export class NoReceiverError extends DiscordPlayerError {
  constructor(message?: string) {
    super(
      ErrorCodes.ERR_NO_RECEIVER,
      message ||
        'No voice receiver is available, maybe connect to a voice channel first?',
    );
  }
}

export class FFmpegError extends DiscordPlayerError {
  constructor(message: string) {
    super(ErrorCodes.ERR_FFMPEG_LOCATOR, message);
  }
}

export class NoAudioResourceError extends DiscordPlayerError {
  constructor(message?: string) {
    super(
      ErrorCodes.ERR_NO_AUDIO_RESOURCE,
      message || 'Expected an audio resource',
    );
  }
}

export class NoGuildQueueError extends DiscordPlayerError {
  constructor(message?: string) {
    super(ErrorCodes.ERR_NO_GUILD_QUEUE, message || 'Expected a guild queue');
  }
}

export class NoGuildError extends DiscordPlayerError {
  constructor(message?: string) {
    super(ErrorCodes.ERR_NO_GUILD, message || 'Expected a guild');
  }
}

export class InfoRequiredError extends DiscordPlayerError {
  constructor(target: string, actual: string) {
    super(
      ErrorCodes.ERR_INFO_REQUIRED,
      `Expected ${target}, found "${actual}"`,
    );
  }
}

export class SerializationError extends DiscordPlayerError {
  constructor() {
    super(
      ErrorCodes.ERR_SERIALIZATION_FAILED,
      "Don't know how to serialize this data",
    );
  }
}

export class DeserializationError extends DiscordPlayerError {
  constructor() {
    super(
      ErrorCodes.ERR_DESERIALIZATION_FAILED,
      "Don't know how to deserialize this data",
    );
  }
}

export class IllegalHookInvocationError extends DiscordPlayerError {
  constructor(target: string, message?: string) {
    super(
      ErrorCodes.ERR_ILLEGAL_HOOK_INVOCATION,
      `Illegal invocation of ${target} hook.${message ? ` ${message}` : ''}`,
    );
  }
}

export class ModuleNotFoundError extends DiscordPlayerError {
  constructor(target: string, description = '') {
    super(
      ErrorCodes.ERR_NOT_EXISTING_MODULE,
      `${target} module does not exist. Install it with \`npm install ${target}\`.${
        description ? ' ' + description : ''
      }`,
    );
  }
}

export class BridgeFailedError extends DiscordPlayerError {
  constructor(id: string | null, error: string) {
    super(
      ErrorCodes.ERR_BRIDGE_FAILED,
      `${
        id ? `(Extractor Execution Context ID is ${id})` : ''
      }Failed to bridge this query:\n${error}`,
    );
  }
}

// For backwards compatibility
export const ErrorCodes = {
  ERR_OUT_OF_SPACE: 'ERR_OUT_OF_SPACE',
  ERR_INVALID_ARG_TYPE: 'ERR_INVALID_ARG_TYPE',
  ERR_NO_RESULT: 'ERR_NO_RESULT',
  ERR_NOT_IMPLEMENTED: 'ERR_NOT_IMPLEMENTED',
  ERR_NOT_EXISTING: 'ERR_NOT_EXISTING',
  ERR_OUT_OF_RANGE: 'ERR_OUT_OF_RANGE',
  ERR_NO_VOICE_CONNECTION: 'ERR_NO_VOICE_CONNECTION',
  ERR_VOICE_CONNECTION_DESTROYED: 'ERR_VOICE_CONNECTION_DESTROYED',
  ERR_NO_VOICE_CHANNEL: 'ERR_NO_VOICE_CHANNEL',
  ERR_INVALID_VOICE_CHANNEL: 'ERR_INVALID_VOICE_CHANNEL',
  ERR_NO_RECEIVER: 'ERR_NO_RECEIVER',
  ERR_FFMPEG_LOCATOR: 'ERR_FFMPEG_LOCATOR',
  ERR_NO_AUDIO_RESOURCE: 'ERR_NO_AUDIO_RESOURCE',
  ERR_NO_GUILD_QUEUE: 'ERR_NO_GUILD_QUEUE',
  ERR_NO_GUILD: 'ERR_NO_GUILD',
  ERR_INFO_REQUIRED: 'ERR_INFO_REQUIRED',
  ERR_SERIALIZATION_FAILED: 'ERR_SERIALIZATION_FAILED',
  ERR_DESERIALIZATION_FAILED: 'ERR_DESERIALIZATION_FAILED',
  ERR_ILLEGAL_HOOK_INVOCATION: 'ERR_ILLEGAL_HOOK_INVOCATION',
  ERR_NOT_EXISTING_MODULE: 'ERR_NOT_EXISTING_MODULE',
  ERR_BRIDGE_FAILED: 'ERR_BRIDGE_FAILED',
} as const;

export type ErrorCodes = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/* eslint-disable @typescript-eslint/no-explicit-any */

export function isDiscordPlayerError(error: any): error is DiscordPlayerError {
  return error != null && error instanceof DiscordPlayerError;
}

/**
 * Handle a `DiscordPlayerError` error.
 * @param error The error to handle
 * @param handler The handler function. This function will only be called if the error is a `DiscordPlayerError`.
 * @param args The arguments to pass to the handler
 * @returns The result of the handler
 * @example ```typescript
 * try {
 *   // ...
 * } catch (error) {
 *  handleDiscordPlayerError(error, (error) => {
 *    console.error(`An error occurred from discord-player: ${error.message}`);
 *  });
 * }
 * ```
 */
export function handleDiscordPlayerError<
  T extends any[],
  F extends (error: DiscordPlayerError, ...args: T) => any,
  R extends ReturnType<F>,
>(error: any, handler: F, args: T): R {
  if (isDiscordPlayerError(error)) {
    return handler(error, ...args) as R;
  }

  return undefined as R;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
