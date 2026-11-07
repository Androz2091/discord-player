import { EventEmitter } from 'node:events';

/** Event map whose values are listener argument tuples. */
export type EventMap<Events> = { [Key in keyof Events]: unknown[] };

/** Typed EventEmitter with a fallback `error` listener so unobserved errors do not crash the process. */
export class SafeEventEmitter<Events extends EventMap<Events>> extends EventEmitter<Events> {
  /** Install a no-op error listener while preserving typed event methods. */
  public constructor() {
    super();
    this.on('error' as never, () => undefined);
  }
}
