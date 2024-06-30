import { StreamType } from 'discord-voip';
import { Readable } from 'stream';
import { unsafe } from '../common/types';

export const PluginType = {
    /**
     * A plugin that provides metadata information for the given track source.
     */
    MetadataExtractor: 'MetadataExtractor',

    /**
     * A plugin that provides a stream for the given track.
     */
    StreamProvider: 'StreamProvider',

    /**
     * A plugin that provides audio effects for the given track stream.
     */
    AudioEffect: 'AudioEffect'
} as const;

export type PluginType = (typeof PluginType)[keyof typeof PluginType];

export interface StreamResult<T> {
    /**
     * The stream or string provided by this plugin.
     */
    stream: T;
    /**
     * The type of the stream.
     */
    type: StreamType;
}

export abstract class Plugin {
    /**
     * The name of this plugin.
     */
    public abstract readonly name: string;

    /**
     * Types of this plugin.
     */
    public abstract readonly types: PluginType[];

    /**
     * Called when this plugin is registered.
     */
    public abstract activate(): Promise<void>;

    /**
     * Called when this plugin is unregistered.
     */
    public abstract deactivate(): Promise<void>;

    /**
     * Validate the given query. This method is only available to `MetadataExtractor` and `StreamProvider` plugins.
     */
    public abstract validateQuery(query: string): Promise<boolean>;

    /**
     * Extract metadata from the given query. This method is only available to `MetadataExtractor` plugins.
     */
    public abstract extractMetadata(query: string): Promise<unsafe>;

    /**
     * Process the given source stream and return a new stream. This method is only available to `AudioEffect` plugins.
     */
    public abstract applyEffects(source: Readable): Readable;

    /**
     * Create a readable stream or a string from the given source. This method is only available to `StreamProvider` plugins.
     */
    public abstract createStream(track: unsafe): StreamResult<Readable | string>;
}
