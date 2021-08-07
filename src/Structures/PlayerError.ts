export enum ErrorStatusCode {
    STREAM_ERROR = "StreamError",
    AUDIO_PLAYER_ERROR = "AudioPlayerError",
    PLAYER_ERROR = "PlayerError",
    NO_AUDIO_RESOURCE = "NoAudioResource",
    UNKNOWN_GUILD = "UnknownGuild",
    INVALID_ARG_TYPE = "InvalidArgType",
    UNKNOWN_EXTRACTOR = "UnknownExtractor",
    INVALID_EXTRACTOR = "InvalidExtractor",
    INVALID_CHANNEL_TYPE = "InvalidChannelType",
    INVALID_TRACK = "InvalidTrack",
    UNKNOWN_REPEAT_MODE = "UnknownRepeatMode",
    TRACK_NOT_FOUND = "TrackNotFound",
    NO_CONNECTION = "NoConnection",
    DESTROYED_QUEUE = "DestroyedQueue"
}

export class PlayerError extends Error {
    message: string;
    statusCode: ErrorStatusCode;
    createdAt = new Date();

    constructor(message: string, code: ErrorStatusCode = ErrorStatusCode.PLAYER_ERROR) {
        super();

        this.message = `[${code}] ${message}`;
        this.statusCode = code;
        this.name = code;

        Error.captureStackTrace(this);
    }

    get createdTimestamp() {
        return this.createdAt.getTime();
    }

    valueOf() {
        return this.statusCode;
    }

    toJSON() {
        return { stack: this.stack, code: this.statusCode, created: this.createdTimestamp };
    }

    toString() {
        return this.stack;
    }
}
