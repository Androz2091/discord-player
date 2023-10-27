import { User } from 'discord.js';
import { Readable } from 'stream';
import { Playlist } from '../fabric/Playlist';
import { Track } from '../fabric/Track';
import { PlayerEvents, SearchQueryType } from '../types/types';
import { ExtractorExecutionContext } from './ExtractorExecutionContext';
import type { RequestOptions } from 'http';
import { Exceptions } from '../errors';
import type { GuildQueueHistory } from '../manager';

export type ExtractorStreamable =
    | Readable
    | string
    | {
          $fmt: string;
          stream: Readable;
      };

export class BaseExtractor<T extends object = object> {
    /**
     * Identifier for this extractor
     */
    public static identifier = 'com.discord-player.extractor';

    /**
     * Priority of this extractor. Higher value means higher priority (will be executed first).
     */
    public priority = 1;

    /**
     * Handle bridge query creation
     * @param track The track to build query for
     */
    public createBridgeQuery = (track: Track) => `${track.title} by ${track.author} official audio`;

    /**
     * Extractor constructor
     * @param context Context that instantiated this extractor
     * @param options Initialization options for this extractor
     */
    public constructor(public context: ExtractorExecutionContext, public options: T = <T>{}) {}

    /**
     * Identifier of this extractor
     */
    public get identifier() {
        return (this.constructor as typeof BaseExtractor).identifier;
    }

    /**
     * Reconfigures this extractor
     * @param options The new options to apply
     */
    public async reconfigure(options: T) {
        this.options = options;
        await this.deactivate();
        await this.activate();
    }

    /**
     * This method will be executed when this extractor is activated
     */
    public async activate() {
        // executed when this extractor is activated
        return;
    }

    /**
     * This method will be executed when this extractor is deactivated
     */
    public async deactivate() {
        // executed when this extractor is deactivated
        return;
    }

    /**
     * Validate incoming query
     * @param query The query to validate
     */
    public async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        void type;
        return false;
    }

    /**
     * Stream the given track
     * @param info The track to stream
     */
    public async stream(info: Track): Promise<ExtractorStreamable> {
        void info;
        throw Exceptions.ERR_NOT_IMPLEMENTED(`${this.constructor.name}.stream()`);
    }

    /**
     * Handle the given query
     * @param query The query to handle
     */
    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        void context;
        throw Exceptions.ERR_NOT_IMPLEMENTED(`${this.constructor.name}.handle()`);
    }

    /**
     * Get related tracks for the given track
     * @param track The track source
     */
    public async getRelatedTracks(track: Track, history: GuildQueueHistory): Promise<ExtractorInfo> {
        void track;
        void history;
        throw Exceptions.ERR_NOT_IMPLEMENTED(`${this.constructor.name}.getRelatedTracks()`);
    }

    /**
     * A stream middleware to handle streams before passing it to the player
     * @param stream The incoming stream
     * @param next The next function
     */
    public handlePostStream(stream: Readable, next: NextFunction) {
        return next(null, stream);
    }

    /**
     * Dispatch an event to the player
     * @param event The event to dispatch
     * @param args The data to dispatch
     */
    public emit<K extends keyof PlayerEvents>(event: K, ...args: Parameters<PlayerEvents[K]>) {
        return this.context.player.emit(event, ...args);
    }

    /**
     * Create extractor response
     * @param playlist The playlist
     * @param tracks The track array
     */
    public createResponse(playlist?: Playlist | null, tracks: Track[] = playlist?.tracks || []): ExtractorInfo {
        return { playlist: playlist || null, tracks };
    }

    /**
     * Write debug message
     * @param message The debug message
     */
    public debug(message: string) {
        return this.context.player.debug(message);
    }

    /**
     * IP rotator instance, if available
     */
    public get routePlanner() {
        return this.context.player.routePlanner;
    }

    /**
     * A flag to indicate `Demuxable` stream support for `opus`/`ogg/opus`/`webm/opus` formats.
     */
    public get supportsDemux() {
        return !!this.context.player.options.skipFFmpeg;
    }
}

export type NextFunction = (error?: Error | null, stream?: Readable) => void;

export interface ExtractorInfo {
    playlist: Playlist | null;
    tracks: Track[];
}

export interface ExtractorSearchContext {
    type?: SearchQueryType | null;
    requestedBy?: User | null;
    requestOptions?: RequestOptions;
}
