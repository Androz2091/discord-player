import { Transform, type TransformCallback, type Writable } from 'node:stream';

/**
 * Represents a stream that can be intercepted and consumed without affecting the original consumer.
 * @example const stream = new InterceptedStream();
 *
 * // real consumer
 * stream.pipe(fs.createWriteStream('file.txt'));
 *
 * // man in the middle consumer
 * const manInTheMiddle = new Writable({
 *  write(chunk, encoding, callback) {
 *   console.log(chunk.toString());
 *   callback();
 *  }
 * });
 *
 * // stream.interceptors is a Set of Writable streams
 * stream.interceptors.add(manInTheMiddle);
 */
export class InterceptedStream extends Transform {
  public readonly interceptors = new Set<Writable>();
  #intercepting = true;

  /**
   * Start intercepting the stream. This is the default state of InterceptedStream.
   */
  public startIntercepting(): void {
    this.#intercepting = true;
  }

  /**
   * Stop intercepting the stream. This will prevent the stream from being consumed by the interceptors.
   * This can be useful when you want to temporarily stop the interception. The stopped state can be resumed by calling startIntercepting again.
   */
  public stopIntercepting(): void {
    this.#intercepting = false;
  }

  /**
   * Whether the stream is being intercepted
   */
  public isIntercepting(): boolean {
    return this.#intercepting;
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.push(chunk, encoding);

    if (this.#intercepting && this.interceptors.size > 0) {
      for (const consumer of this.interceptors) {
        consumer.write(chunk, encoding);
      }
    }

    callback();
  }

  _final(callback: TransformCallback): void {
    for (const consumer of this.interceptors) {
      consumer.end();
    }

    callback();
  }

  public _destroy(error: Error, callback: TransformCallback): void {
    const ignoreError = String(error).includes('ERR_STREAM_PREMATURE_CLOSE');
    const err = ignoreError ? undefined : error;

    for (const consumer of this.interceptors) {
      consumer.destroy(err);
    }

    this.interceptors.clear();

    callback(err);
  }
}
