export type PlayerExceptionMessage = string | Record<string, unknown>;

export class PlayerException extends Error {
  public constructor(message: PlayerExceptionMessage) {
    super(
      typeof message === 'string' ? message : JSON.stringify(message, null, 2),
    );
  }
}
