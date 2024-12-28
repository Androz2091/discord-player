import { DiscordPlayerError, isDiscordPlayerError } from '../errors';

export class TypeUtil {
  private constructor() {
    return TypeUtil;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public static isFunction(t: unknown): t is Function {
    return typeof t === 'function';
  }

  public static isNumber(t: unknown): t is number {
    return typeof t === 'number' && !isNaN(t);
  }

  public static isString(t: unknown): t is string {
    return typeof t === 'string';
  }

  public static isBoolean(t: unknown): t is boolean {
    return typeof t === 'boolean';
  }

  public static isNullish(t: unknown): t is null | undefined {
    return t == null;
  }

  public static isArray(t: unknown): t is unknown[] {
    return Array.isArray(t);
  }

  public static isError(t: unknown): t is Error {
    return t instanceof Error;
  }

  public static isDiscordPlayerError(t: unknown): t is DiscordPlayerError {
    return isDiscordPlayerError(t);
  }
}
