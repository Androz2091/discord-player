import type { Readable } from 'node:stream';
import type { DiscordPlayerEvents } from '../player.js';
import type { Track } from '../structures/track.js';
import type { Playlist } from '../structures/playlist.js';
import type { ExtractorExecutionContext } from './extractor-execution-context.js';
import type { SearchQueryType } from './query-types.js';
import type { ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, NextFunction } from './extractor-types.js';

/** Minimal v7 lifecycle and source API, adapted to the source operation registry. */
export class BaseExtractor<Options extends object = object> {
  /** Default identifier; subclasses should override. */
  public static identifier = 'org.example.extractor';

  /** Higher priority wins before match confidence. */
  public priority = 1;

  /** Supported explicit query protocols. */
  public protocols: string[] = [];

  /** Create a compatibility instance; use player.extractors.register to own it.
   * @param context Owning compatibility context.
   * @param options Original extractor options.
   */
  constructor(
    /** Owning legacy registration context. */
    public context: ExtractorExecutionContext,
    /** Original local extractor configuration. */
    public options: Options = {} as Options,
  ) {}

  /** Subclass static identifier. */
  public get identifier(): string {
    return (this.constructor as typeof BaseExtractor).identifier;
  }

  /** Obsolete demux support is unavailable. */
  public get supportsDemux(): boolean {
    return false;
  }

  /** Acquire extractor resources. */
  public async activate(): Promise<void> {}

  /** Release extractor resources. */
  public async deactivate(): Promise<void> {}

  /** Recreate the owned registration with new options.
   * @param options Replacement options.
   */
  public async reconfigure(options: Options): Promise<void> {
    await this.context.reconfigure(this.identifier, options);
  }

  /** Test whether this extractor accepts a query.
   * @param query Search text.
   * @param type Query hint.
   */
  public async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
    void query;
    void type;

    return false;
  }

  /** Resolve metadata.
   * @param query Search text.
   * @param context Search hints.
   */
  public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    void query;
    void context;

    return this.createResponse();
  }

  /** Resolve media, or decline to enable bridging.
   * @param track Track to stream.
   */
  public async stream(track: Track): Promise<ExtractorStreamable | undefined> {
    void track;

    return undefined;
  }

  /** Resolve related metadata.
   * @param track Seed track.
   * @param history Optional queue history; local execution only.
   */
  public async getRelatedTracks(track: Track, history?: unknown): Promise<ExtractorInfo> {
    void track;
    void history;

    return this.createResponse();
  }

  /** Explicit fallback for another source.
   * @param track Track needing a stream.
   * @param sourceExtractor Original extractor, if legacy.
   */
  public async bridge(track: Track, sourceExtractor: BaseExtractor<any> | null): Promise<ExtractorStreamable | null> {
    void track;
    void sourceExtractor;

    return null;
  }

  /** Transform an encoded local Readable. Raw codec overrides are unsupported.
   * @param stream Encoded input.
   * @param next Completion callback.
   */
  public handlePostStream(stream: Readable, next: NextFunction): void {
    next(null, stream);
  }

  /** Build an anonymous bridge query.
   * @param track Track metadata.
   */
  public createBridgeQuery(track: Track): string {
    return `${track.title} by ${track.author}`;
  }

  /** Construct a metadata response.
   * @param playlist Optional playlist.
   * @param tracks Ordered tracks, defaulting to playlist entries.
   */
  public createResponse(playlist: Playlist | null = null, tracks: Track[] = playlist?.tracks ?? []): ExtractorInfo {
    return { playlist, tracks };
  }

  /** Publish a diagnostic.
   * @param message Diagnostic text.
   */
  public debug(message: string): void {
    this.context.player.debug(message);
  }

  /** Forward supported Player events.
   * @param event Player event.
   * @param args Event arguments.
   */
  public emit<K extends keyof DiscordPlayerEvents>(event: K, ...args: DiscordPlayerEvents[K]): boolean {
    return this.context.player.emit(event, ...(args as never));
  }
}
