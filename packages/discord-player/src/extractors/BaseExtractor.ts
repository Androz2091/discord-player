import { User } from 'discord.js';
import { Readable } from 'stream';
import { Playlist } from '../Structures/Playlist';
import { Track } from '../Structures/Track';
import { PlayerEvents, SearchQueryType } from '../types/types';
import { ExtractorExecutionContext } from './ExtractorExecutionContext';

export class BaseExtractor {
    /**
     * Identifier for this extractor
     */
    public static identifier = 'com.discord-player.extractor';

    /**
     * Extractor constructor
     * @param context Context that instantiated this extractor
     */
    public constructor(public context: ExtractorExecutionContext) {}

    /**
     * Identifier of this extractor
     */
    public get identifier() {
        return (this.constructor as typeof BaseExtractor).identifier;
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
    public async stream(info: Track): Promise<Readable | string> {
        void info;
        throw new Error('Not Implemented');
    }

    /**
     * Handle the given query
     * @param query The query to handle
     */
    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        void context;
        throw new Error('Not Implemented');
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
}

export type NextFunction = (error?: Error | null, stream?: Readable) => void;

export interface ExtractorInfo {
    playlist: Playlist | null;
    tracks: Track[];
}

export interface ExtractorSearchContext {
    type?: SearchQueryType | null;
    requestedBy?: User | null;
}
