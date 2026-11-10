export interface AsyncQueueAcquireOptions {
  /** A signal used to cancel an acquisition while it is waiting. */
  signal?: AbortSignal;
}

type LockWaiter = {
  resolve: () => void;

  reject: (reason?: unknown) => void;

  signal?: AbortSignal;

  onAbort?: () => void;
};

type LockState = {
  held: boolean;

  waiters: LockWaiter[];
};

/**
 * A handle for an acquired asynchronous lock.
 *
 * The handle can be released explicitly or automatically with `using`.
 */
export class AsyncQueueLock {
  /** Whether this handle has already released its lock. */
  private released = false;

  /**
   * Creates a lock handle.
   *
   * @param onRelease The callback used to release the acquired lock.
   */
  public constructor(private readonly onRelease: () => void) {}

  /**
   * Releases the associated lock.
   *
   * Releasing a handle more than once has no effect.
   */
  public release(): void {
    if (this.released) return;

    this.released = true;
    this.onRelease();
  }

  /**
   * Releases the associated lock when leaving an `using` scope.
   */
  public [Symbol.dispose](): void {
    this.release();
  }
}

/**
 * A keyed asynchronous lock queue.
 *
 * Acquisitions for the same lock ID are resolved in FIFO order. Different lock
 * IDs are independent and can be acquired at the same time.
 */
export class AsyncQueue {
  /** The locks that are currently held or have pending acquisitions. */
  private readonly locks = new Map<string, LockState>();

  /**
   * Acquires a lock, waiting for earlier acquisitions of the same ID to finish.
   *
   * @param lockId The ID of the lock to acquire.
   * @param options Options controlling the acquisition.
   * @returns A promise for a disposable lock handle.
   * @throws The signal's abort reason if the acquisition is cancelled.
   */
  public acquire(lockId: string, options: AsyncQueueAcquireOptions = {}): Promise<AsyncQueueLock> {
    if (options.signal?.aborted) {
      return Promise.reject(options.signal.reason);
    }

    const state = this.locks.get(lockId);

    if (!state) {
      this.locks.set(lockId, { held: true, waiters: [] });

      return Promise.resolve(new AsyncQueueLock(() => this.release(lockId)));
    }

    return new Promise<AsyncQueueLock>((resolve, reject) => {
      const waiter: LockWaiter = {
        resolve: () => resolve(new AsyncQueueLock(() => this.release(lockId))),

        reject,
        signal: options.signal,
      };
      const onAbort = (): void => {
        const index = state.waiters.indexOf(waiter);

        if (index !== -1) state.waiters.splice(index, 1);

        this.cleanupLock(lockId, state);
        reject(options.signal?.reason);
      };

      waiter.onAbort = onAbort;
      state.waiters.push(waiter);
      options.signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Releases a lock and grants it to the next waiting acquisition.
   *
   * @param lockId The ID of the lock to release.
   * @throws {Error} If the lock is not currently held.
   */
  private release(lockId: string): void {
    const state = this.locks.get(lockId);

    if (!state) {
      throw new Error(`Cannot release lock "${lockId}" because it is not held.`);
    }

    const waiter = state.waiters.shift();

    if (!waiter) {
      state.held = false;
      this.locks.delete(lockId);

      return;
    }

    this.removeAbortListener(waiter);
    waiter.resolve();
  }

  /**
   * Indicates whether a lock is currently held or has pending acquisitions.
   *
   * @param lockId The ID of the lock to check.
   * @returns `true` when the lock exists in the queue; otherwise, `false`.
   */
  public has(lockId: string): boolean {
    return this.locks.has(lockId);
  }

  /**
   * Removes all pending acquisitions without releasing held locks.
   *
   * Pending acquisitions are rejected with the supplied reason.
   *
   * @param reason The reason used to reject pending acquisitions.
   */
  public clear(reason: unknown = new Error('Pending lock acquisition was cleared.')): void {
    for (const [lockId, state] of this.locks) {
      for (const waiter of state.waiters.splice(0)) {
        this.removeAbortListener(waiter);
        waiter.reject(reason);
      }

      this.cleanupLock(lockId, state);
    }
  }

  /**
   * Removes an abort listener from a waiting acquisition.
   *
   * @param waiter The waiting acquisition to clean up.
   */
  private removeAbortListener(waiter: LockWaiter): void {
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort);
    }
  }

  /**
   * Removes an unlocked lock state that has no pending acquisitions.
   *
   * @param lockId The lock ID to clean up.
   * @param state The lock state to inspect.
   */
  private cleanupLock(lockId: string, state: LockState): void {
    if (!state.held && state.waiters.length === 0 && this.locks.get(lockId) === state) {
      this.locks.delete(lockId);
    }
  }
}
