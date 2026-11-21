import type { Readable } from 'node:stream';
import type { RequestOptions } from 'node:http';
import type { Track, TrackRequester } from '../structures/track.js';
import type { SearchResultData } from '../structures/search-result.js';
import type { SourceStream } from '../plugins/types.js';
import type { BaseExtractor } from './base-extractor.js';
import type { ExtractorExecutionContext } from './extractor-execution-context.js';
import type { SearchQueryType } from './query-types.js';

/** Metadata snapshot supplied to legacy related-track discovery; no queue controls are exposed. */
export interface ExtractorRelatedHistory {
  /** Retained tracks, ordered oldest to newest. No mutation or playback controls are supplied. */
  readonly tracks: {
    /** Copy retained tracks. */
    toArray(): Track[];
    /** Number of retained tracks. */
    readonly size: number;
    /** Read the most recent retained track. */
    peek(): Track | undefined;
    /** Whether no tracks are retained. */
    isEmpty(): boolean;
    /** Read an array-style index. @param index Track index, including negative indices. */
    at(index: number): Track | undefined;
    /** Filter retained tracks. @param predicate Track predicate. */
    filter(predicate: (track: Track) => boolean): Track[];
    /** Map retained tracks. @param callback Mapping callback. */
    map<T>(callback: (track: Track) => T): T[];
    /** Visit retained tracks. @param callback Visitor callback. */
    forEach(callback: (track: Track) => void): void;
    /** Test all retained tracks. @param predicate Track predicate. */
    every(predicate: (track: Track) => boolean): boolean;
    /** Locate a retained track. @param track Track to locate. */
    indexOf(track: Track): number;
    /** Iterate oldest to newest. */
    [Symbol.iterator](): Iterator<Track>;
    /** Test retained tracks. @param predicate Track predicate. */
    some(predicate: (track: Track) => boolean): boolean;
    /** Find a retained track. @param predicate Track predicate. */
    find(predicate: (track: Track) => boolean): Track | undefined;
  };
}

/** Legacy extractor result. */
export type ExtractorInfo = SearchResultData;

/** Legacy encoded source; format hints cannot restore the obsolete audio stack. */
export type ExtractorStreamable =
  | SourceStream
  | {
      /** Encoded local media stream. */
      stream: Readable;

      /** Legacy format hint; raw codec overrides require migration. */
      $fmt: string;
    };

/** Legacy post-stream callback.
 * @param error Transformation failure, or null on success.
 * @param stream Replacement encoded stream, or omit to retain the original.
 */
export type NextFunction = (error?: Error | null, stream?: Readable) => void;

/** Search context passed to legacy handle methods. */
export interface ExtractorSearchContext {
  /** Query type hint. */
  type?: SearchQueryType | null;

  /** Structural requester identity. */
  requestedBy?: TrackRequester | null;

  /** Local HTTP request options; never persisted. */
  requestOptions?: RequestOptions;

  /** Explicit routing protocol. */
  protocol?: string | null;
}

/** Class constructors only: instances and modern plugin descriptors are not accepted. */
export type ExtractorConstructor<O extends object = any> = (new (
  context: ExtractorExecutionContext,
  options: O,
) => BaseExtractor<O>) & {
  /** Stable legacy source identifier. */
  identifier: string;
};

/** Legacy identifier or owned instance. */
export type ExtractorResolvable = string | BaseExtractor<any>;

/** Result returned from compatibility bridge requests. */
export interface ExtractorExecutionResult<T = unknown> {
  /** Legacy bridge provider, or null for a modern source plugin. */
  extractor: BaseExtractor<any> | null;

  /** Successful requests have no error; failures reject. */
  error: null;

  /** Resolved source. */
  result: T;
}
