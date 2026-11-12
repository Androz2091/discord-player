import { Store, type Later, type Options as BaseOptions } from '@fx/base';

/** Options of the app package; the name collides with the base package's `Options`. */
export interface Options {
  /** App option. */
  app: true;
}

/** Extends a cross-package class. */
export class AppStore extends Store<number> {
  /** Own method. */
  run(): Later<number> {
    return Promise.resolve(new Map());
  }
}

/** Uses cross-package and external types, nested in generics and unions. */
export function load(input: BaseOptions | Options, signal?: AbortSignal): Promise<Array<Store<string> | null>> {
  void input;
  void signal;

  return Promise.resolve([]);
}

/** Enumeration with documented members. */
export enum Mode {
  /** Fast mode. */
  Fast = 'fast',
  /** Slow mode. */
  Slow = 'slow',
}
