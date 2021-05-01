export default class PlayerError extends Error {
    constructor(msg: string, name?: string) {
        super();
        this.name = name ?? 'PlayerError';
        this.message = msg;
        Error.captureStackTrace(this);
    }
}

export { PlayerError };
