import { DefaultListener } from '@discord-player/utils';
import { ListenerSignature } from '@discord-player/utils';
import { EventEmitter } from '@discord-player/utils';
import { Util } from './Util';

export class PlayerEventsEmitter<
  L extends ListenerSignature<L> = DefaultListener,
> extends EventEmitter<L> {
  #hasDebugger = false;
  public constructor(public requiredEvents: Array<keyof L> = []) {
    super();
  }

  public on<K extends keyof L>(name: K, listener: L[K]) {
    if (name === 'debug') {
      this.#hasDebugger = true;
    }

    return super.on(name, listener);
  }

  public once<K extends keyof L>(name: K, listener: L[K]) {
    if (name === 'debug') {
      this.#hasDebugger = true;
    }

    return super.once(name, listener);
  }

  public addListener<K extends keyof L>(name: K, listener: L[K]) {
    if (name === 'debug') {
      this.#hasDebugger = true;
    }

    return super.addListener(name, listener);
  }

  public off<K extends keyof L>(name: K, listener: L[K]) {
    this.#hasDebugger = this.listenerCount('debug' as K) > 0;

    return super.off(name, listener);
  }

  public removeListener<K extends keyof L>(name: K, listener: L[K]) {
    this.#hasDebugger = this.listenerCount('debug' as K) > 0;

    return super.removeListener(name, listener);
  }

  public removeAllListeners<K extends keyof L>(name?: K) {
    this.#hasDebugger = this.listenerCount('debug' as K) > 0;

    return super.removeAllListeners(name);
  }

  public emit<K extends keyof L>(name: K, ...args: Parameters<L[K]>) {
    if (
      this.requiredEvents.includes(name) &&
      !this.eventNames().includes(name)
    ) {
      // eslint-disable-next-line no-console
      console.error(...args);
      Util.warn(
        `No event listener found for event "${String(
          name,
        )}". Events ${this.requiredEvents
          .map((m) => `"${String(m)}"`)
          .join(', ')} must have event listeners.`,
        'UnhandledEventsWarning',
      );
      return false;
    }

    return super.emit(name, ...args);
  }

  public get hasDebugger() {
    return this.#hasDebugger;
  }
}
