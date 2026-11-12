/** An explicitly controlled async boundary, without timing-dependent sleeps. */
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });

  return { promise, resolve, reject };
}

/** Let queued async lock continuations and event callbacks finish. */
export async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
