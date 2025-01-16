import { SnowflakeUtil } from 'discord.js';

export interface AsyncQueueAcquisitionOptions {
  /**
   * AbortSignal to cancel this entry
   */
  signal?: AbortSignal;
}

export type AsyncQueueExceptionHandler = (exception: Error) => void;

export class AsyncQueue {
  /**
   * The queued entries
   */
  public entries: Array<AsyncQueueEntry> = [];

  public exceptionHandler?: AsyncQueueExceptionHandler;

  /**
   * Clear entries queue
   * @param consume Whether or not to consume all entries before clearing
   */
  public clear(consume = false) {
    if (consume) {
      this.entries.forEach((entry) => entry.consume());
    }

    this.entries = [];
  }

  /**
   * The total number of entries in this queue. Returns `0` if no entries are available.
   */
  public get size() {
    return this.entries.length;
  }

  /**
   * Acquire an entry.
   *
   * @example // lock the queue
   * const entry = asyncQueue.acquire();
   * // wait until previous task is completed
   * await entry.getTask();
   * // do something expensive
   * await performSomethingExpensive();
   * // make sure to release the lock once done
   * asyncQueue.release();
   *
   */
  public acquire(options?: AsyncQueueAcquisitionOptions) {
    const entry = new AsyncQueueEntry(this, options);

    if (this.exceptionHandler) entry.getTask().catch(this.exceptionHandler);

    if (this.entries.length === 0) {
      this.entries.push(entry);
      entry.consume();
      return entry;
    }

    this.entries.push(entry);
    return entry;
  }

  /**
   * Release the current acquisition and move to next entry.
   */
  public release(): void {
    if (!this.entries.length) return;

    this.entries.shift();
    this.entries[0]?.consume();
  }

  /**
   * Cancel all entries
   */
  public cancelAll() {
    this.entries.forEach((entry) => entry.cancel());
  }

  /**
   * Remove the given entry from the queue
   * @param entry The entry to remove
   */
  public removeEntry(entry: AsyncQueueEntry) {
    const entryIdx = this.entries.indexOf(entry);

    if (entryIdx !== -1) {
      this.entries.splice(entryIdx, 1);
      return true;
    }

    return false;
  }
}

export class AsyncQueueEntry {
  public readonly id = SnowflakeUtil.generate().toString();
  private readonly promise: Promise<void>;
  public signal: AbortSignal | null = null;
  public onAbort: (() => void) | null = null;
  private resolve!: () => void;
  private reject!: (err: Error) => void;

  public constructor(
    public queue: AsyncQueue,
    public options?: AsyncQueueAcquisitionOptions,
  ) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    if (this.options?.signal) {
      this.setAbortSignal(this.options.signal);
    }
  }

  public setAbortSignal(signal: AbortSignal) {
    if (signal.aborted) return;
    this.signal = signal;
    this.onAbort = () => {
      this.queue.removeEntry(this);
      this.cancel();
    };

    this.signal.addEventListener('abort', this.onAbort);
  }

  public consume() {
    this.cleanup();
    this.resolve();
  }

  public release() {
    this.consume();
    this.queue.release();
  }

  public cancel() {
    this.cleanup();
    this.reject(new Error('Cancelled'));
  }

  public cleanup() {
    if (this.onAbort) this.signal?.removeEventListener('abort', this.onAbort);
    this.signal = null;
    this.onAbort = null;
  }

  public getTask() {
    return this.promise;
  }
}
