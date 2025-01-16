import { StreamType } from 'discord-voip';
import type { Track } from './fabric';
import type { Player } from './Player';
import type { GuildQueue } from './queue';
import type { InterceptedStream } from './stream/InterceptedStream';

type Awaitable<T> = T | PromiseLike<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ShouldInterceptFunction = <T = any>(
  queue: GuildQueue<T>,
  track: Track,
  format: StreamType,
  stream: InterceptedStream,
) => Awaitable<boolean>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnInterceptedStreamHandler = <T = any>(
  queue: GuildQueue<T>,
  track: Track,
  format: StreamType,
  stream: InterceptedStream,
) => Awaitable<void>;

export interface PlayerStreamInterceptorOptions {
  /**
   * Determines whether the stream should be intercepted.
   */
  shouldIntercept?: ShouldInterceptFunction;
}

export class PlayerStreamInterceptor {
  #onStream = new Set<OnInterceptedStreamHandler>();

  /**
   * Creates a new PlayerStreamInterceptor instance.
   * @param player The player instance
   * @param options The interceptor options
   */
  public constructor(
    public readonly player: Player,
    private readonly options: PlayerStreamInterceptorOptions,
  ) {}

  /**
   * Handles the intercepted stream.
   * @param queue The guild queue
   * @param track The track
   * @param stream The intercepted stream
   * @returns Whether the stream was intercepted
   */
  public async handle<T = unknown>(
    queue: GuildQueue<T>,
    track: Track,
    type: StreamType,
    stream: InterceptedStream,
  ): Promise<boolean> {
    const filter = this.options.shouldIntercept;

    if (filter) {
      const result = await filter(queue, track, type, stream);
      if (!result) return false;
    }

    const hasListeners = this.#onStream.size;

    if (!hasListeners) return false;

    await Promise.all(
      [...this.#onStream].map((handler) => handler(queue, track, type, stream)),
    );

    return true;
  }

  /**
   * Adds a new intercepted stream listener.
   * @param handler The handler
   * @returns A function to remove the listener
   */
  public onStream(handler: OnInterceptedStreamHandler): () => void {
    this.#onStream.add(handler);

    return () => {
      this.#onStream.delete(handler);
    };
  }
}
