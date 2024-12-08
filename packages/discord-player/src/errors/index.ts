const DiscordPlayerErrors = {
  ERR_OUT_OF_SPACE: {
    name: 'ERR_OUT_OF_SPACE',
    type: RangeError,
    createError(target: string, capacity: number, total: number) {
      return `[${this.constructor.name}] Max capacity reached for ${target} (Capacity ${capacity}/Total ${total})`;
    },
  },
  ERR_INVALID_ARG_TYPE: {
    name: 'ERR_INVALID_ARG_TYPE',
    type: TypeError,
    createError(target: string, expectation: string, found: string) {
      return `[${this.constructor.name}] Expected ${target} to be "${expectation}", received "${found}"`;
    },
  },
  ERR_NO_RESULT: {
    name: 'ERR_NO_RESULT',
    type: Error,
    createError(message: string) {
      return `[${this.constructor.name}] ${message}`;
    },
  },
  ERR_NOT_IMPLEMENTED: {
    name: 'ERR_NOT_IMPLEMENTED',
    type: Error,
    createError(target: string) {
      return `[${this.constructor.name}] ${target} is not yet implemented`;
    },
  },
  ERR_NOT_EXISTING: {
    name: 'ERR_NOT_EXISTING',
    type: Error,
    createError(target: string) {
      return `[${this.constructor.name}] ${target} does not exist`;
    },
  },
  ERR_OUT_OF_RANGE: {
    name: 'ERR_OUT_OF_RANGE',
    type: RangeError,
    createError(target: string, value: string, minimum: string, maximum: string) {
      return `[${this.constructor.name}] ${target} is out of range (Expected minimum ${maximum} and maximum ${maximum}, got ${value})`;
    },
  },
  ERR_NO_VOICE_CONNECTION: {
    name: 'ERR_NO_VOICE_CONNECTION',
    type: Error,
    createError(message?: string) {
      return (
        `[${this.constructor.name}] ` +
        (message || 'No voice connection available, maybe connect to a voice channel first?')
      );
    },
  },
  ERR_VOICE_CONNECTION_DESTROYED: {
    name: 'ERR_VOICE_CONNECTION_DESTROYED',
    type: Error,
    createError() {
      return `[${this.constructor.name}] ` + 'Cannot use destroyed voice connection';
    },
  },
  ERR_NO_VOICE_CHANNEL: {
    name: 'ERR_NO_VOICE_CHANNEL',
    type: Error,
    createError() {
      return `[${this.constructor.name}] ` + 'Could not get the voice channel';
    },
  },
  ERR_INVALID_VOICE_CHANNEL: {
    name: 'ERR_INVALID_VOICE_CHANNEL',
    type: Error,
    createError() {
      return `[${this.constructor.name}] ` + 'Expected a voice channel';
    },
  },
  ERR_NO_RECEIVER: {
    name: 'ERR_NO_RECEIVER',
    type: Error,
    createError(message?: string) {
      return (
        `[${this.constructor.name}] ` +
        (message || 'No voice receiver is available, maybe connect to a voice channel first?')
      );
    },
  },
  ERR_FFMPEG_LOCATOR: {
    name: 'ERR_FFMPEG_LOCATOR',
    type: Error,
    createError(message: string) {
      return `[${this.constructor.name}] ` + message;
    },
  },
  ERR_NO_AUDIO_RESOURCE: {
    name: 'ERR_NO_AUDIO_RESOURCE',
    type: Error,
    createError(message?: string) {
      return `[${this.constructor.name}] ` + (message || 'Expected an audio resource');
    },
  },
  ERR_NO_GUILD_QUEUE: {
    name: 'ERR_NO_GUILD_QUEUE',
    type: Error,
    createError(message?: string) {
      return `[${this.constructor.name}] ` + (message || 'Expected a guild queue');
    },
  },
  ERR_NO_GUILD: {
    name: 'ERR_NO_GUILD',
    type: Error,
    createError(message?: string) {
      return `[${this.constructor.name}] ` + (message || 'Expected a guild');
    },
  },
  ERR_INFO_REQUIRED: {
    name: 'ERR_INFO_REQUIRED',
    type: Error,
    createError(target: string, actual: string) {
      return `[${this.constructor.name}] Expected ${target}, found "${actual}"`;
    },
  },
  ERR_SERIALIZATION_FAILED: {
    name: 'ERR_SERIALIZATION_FAILED',
    type: Error,
    createError() {
      return `[${this.type.name}]` + "Don't know how to serialize this data";
    },
  },
  ERR_DESERIALIZATION_FAILED: {
    name: 'ERR_DESERIALIZATION_FAILED',
    type: Error,
    createError() {
      return `[${this.type.name}]` + "Don't know how to deserialize this data";
    },
  },
  ERR_ILLEGAL_HOOK_INVOCATION: {
    name: 'ERR_ILLEGAL_HOOK_INVOCATION',
    type: Error,
    createError(target: string, message?: string) {
      return `[${this.type.name}]` + `Illegal invocation of ${target} hook.${message ? ` ${message}` : ''}`;
    },
  },
  ERR_NOT_EXISTING_MODULE: {
    name: 'ERR_NOT_EXISTING_MODULE',
    type: Error,
    createError(target: string, description = '') {
      return (
        `[${this.type.name}]` +
        `${target} module does not exist. Install it with \`npm install ${target}\`.${
          description ? ' ' + description : ''
        }`
      );
    },
  },
  ERR_BRIDGE_FAILED: {
    name: 'ERR_BRIDGE_FAILED',
    type: Error,
    createError(id: string | null, error: string) {
      return (
        `[${this.type.name}]` +
        `${id ? `(Extractor Execution Context ID is ${id})` : ''}Failed to bridge this query:\n${error}`
      );
    },
  },
} as const;

type FinalException<O extends (typeof DiscordPlayerErrors)[keyof typeof DiscordPlayerErrors]> = {
  name: O['name'];
} & InstanceType<O['type']>;

type DiscordPlayerException = {
  [K in keyof typeof DiscordPlayerErrors]: (
    ...args: Parameters<(typeof DiscordPlayerErrors)[K]['createError']>
  ) => FinalException<(typeof DiscordPlayerErrors)[K]>;
};

const target = {} as DiscordPlayerException;

const handler: ProxyHandler<typeof target> = {
  get(target, p: keyof typeof DiscordPlayerErrors, receiver) {
    const err = DiscordPlayerErrors[p];

    if (!err) return Reflect.get(target, p, receiver);

    return (...args: Parameters<(typeof err)['createError']>) => {
      // @ts-expect-error
      const exception = new err.type(err.createError(...args));
      exception.name = err.name;

      return exception;
    };
  },
};

export const ErrorCodes = (() => {
  type ErrCodes = {
    -readonly [K in keyof typeof DiscordPlayerErrors]: (typeof DiscordPlayerErrors)[K]['name'];
  };

  const dict = {} as ErrCodes;

  for (const prop in DiscordPlayerErrors) {
    // @ts-expect-error
    dict[prop] = prop;
  }

  return Object.freeze(dict);
})();
export const Exceptions = new Proxy(target, handler);
