import type { GuildQueueManager } from '../managers/guild-queue.manager.js';
import type { DiscordSession, NodeSelection } from '@remedia/client';
import {
  GuildQueueEvents,
  GuildQueuePlayerNode,
  type GuildQueueEventsMap,
  type GuildQueuePlayerNodeSessionCreateOptions,
} from '../index.js';
import { GuildQueueHistoryManager } from '../managers/guild-queue-history.manager.js';
import { Queue } from './common/queue.js';
import type { Track } from './track.js';
import { Playlist } from './playlist.js';
import { AsyncQueue } from '../utils/async-queue.js';

export interface GuildQueueOptions<Metadata = any> {
  /**
   * The node selection strategy to use for this guild queue.
   */
  selectNode?: NodeSelection;
  /**
   * The arbitrary metadata associated with this guild queue.
   */
  metadata: Metadata;
  /**
   * The maximum number of tracks to keep in the history stack for this guild queue.
   * If not specified, defaults to 50.
   */
  maxHistorySize?: number;
}

type OmitFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;
type TrackResolvable = Track;

export class GuildQueue<Metadata = any> {
  /**
   * The `Track` queue for this guild queue.
   */
  public readonly tracks: Queue<Track>;

  /**
   * The node manager for this guild queue, responsible for handling node selection and session management.
   */
  public node: GuildQueuePlayerNode;

  /**
   * The history manager for this guild queue, responsible for managing the history of played tracks.
   */
  public history: GuildQueueHistoryManager;

  /**
   * The async queue for this guild queue, used to ensure that operations are executed in a sequential manner.
   */
  public tasks: AsyncQueue;

  /**
   * Creates a new instance of the GuildQueue class, which represents a queue for a specific guild.
   * @param manager The GuildQueueManager instance that manages this guild queue.
   * @param guildId The ID of the guild for which this queue is created.
   * @param options The options to configure the guild queue, including node selection strategy and arbitrary metadata.
   */
  public constructor(
    public readonly manager: GuildQueueManager,
    public readonly guildId: string,
    public readonly options: GuildQueueOptions<Metadata>,
  ) {
    this.tracks = new Queue<Track>(0);
    this.node = new GuildQueuePlayerNode(this);
    this.history = new GuildQueueHistoryManager(this);
    this.tasks = new AsyncQueue();
  }

  /**
   * Emits the given event into this guild queue's events channel.
   * @param event The event name to emit.
   * @param args The arguments to pass along with the event.
   */
  public emit<K extends keyof GuildQueueEventsMap>(event: K, ...args: OmitFirst<GuildQueueEventsMap[K]>): boolean {
    return this.manager.player.events.emit.apply(this.manager.player.events, [event, this, ...args]);
  }

  /**
   * The arbitrary metadata associated with this guild queue.
   */
  public get metadata(): Metadata {
    return this.options.metadata;
  }

  /**
   * Casts the current GuildQueue instance to a GuildQueue with a different metadata type.
   * @returns The current GuildQueue instance casted to a GuildQueue with the specified metadata type.
   */
  public asMetadata<M>(): GuildQueue<M> {
    return this as unknown as GuildQueue<M>;
  }

  /**
   * Sets the arbitrary metadata associated with this guild queue.
   * @param value The new metadata value to set.
   */
  public set metadata(value: Metadata) {
    this.options.metadata = value;
  }

  /**
   * Connects the guild queue to a voice channel by creating a new DiscordSession for the associated guild queue node.
   * @param options The options to use when creating the new DiscordSession.
   * @returns The newly created DiscordSession instance.
   */
  public async connect(options: GuildQueuePlayerNodeSessionCreateOptions): Promise<DiscordSession> {
    using _lock = await this.tasks.acquire('queue.connect');
    const session = await this.node.createSession(options);
    await session.connect();
    return session;
  }

  /**
   * Destroys the guild queue, performing any necessary cleanup and resource deallocation.
   * This method should be called when the guild queue is no longer needed.
   */
  public async destroy(): Promise<void> {
    using _lock = await this.tasks.acquire('queue.destroy');
    await this.node.destroySession();
    this.manager.cache.delete(this.guildId);
  }

  /**
   * Whether this guild queue is currently playing a track.
   * @returns True if the guild queue is currently playing a track, false otherwise.
   */
  public isPlaying() {
    const session = this.node.getSession(false);
    if (!session) return false;
    return ['starting', 'playing', 'pausing', 'resuming', 'paused'].includes(session.state);
  }

  /**
   * Adds a track, playlist, or collection of tracks to the guild queue.
   *
   * @param track The track, playlist, or tracks to add.
   */
  public addTrack(track: Track | Track[] | Playlist): void {
    const tracks = track instanceof Playlist ? track.tracks : track;
    const isMultiple = Array.isArray(tracks);
    const toAdd = isMultiple ? tracks : [tracks];

    this.tracks.merge(toAdd);
    if (isMultiple) {
      this.emit(GuildQueueEvents.AudioTracksAdd, tracks);
    } else {
      this.emit(GuildQueueEvents.AudioTrackAdd, tracks);
    }
  }

  /**
   * Adds multiple tracks to the guild queue's track queue.
   * @param tracks The array of tracks to add to the queue.
   */
  public addTracks(tracks: Track[]): void {
    this.addTrack(tracks);
  }

  /**
   * Removes a track from the guild queue.
   *
   * @param track The track to remove.
   * @returns The removed track, or `undefined` if it was not found.
   */
  public removeTrack(track: TrackResolvable): Track | undefined {
    const tracks = this.tracks.toArray();
    const index = tracks.indexOf(track);
    if (index === -1) return undefined;

    const [removed] = tracks.splice(index, 1);
    this.replaceTracks(tracks);
    this.emit(GuildQueueEvents.AudioTrackRemove, removed!);
    return removed;
  }

  /**
   * Prepends a track or collection of tracks to the queue.
   *
   * @param track The track or tracks to insert.
   * @param index The index before which to insert the tracks.
   */
  public prepend(track: Track | Queue<Track> | Track[], index = 0): void {
    const tracks = this.toTracks(track);
    this.assertInsertionIndex(index);
    this.insertTracks(tracks, index);
  }

  /**
   * Appends a track or collection of tracks to the queue.
   *
   * @param track The track or tracks to insert.
   * @param index The index after which to insert the tracks.
   */
  public append(track: Track | Queue<Track> | Track[], index = 0): void {
    const tracks = this.toTracks(track);
    this.assertInsertionIndex(index);
    this.insertTracks(tracks, index === this.tracks.size ? index : index + 1);
  }

  /**
   * Inserts a track at a specific queue index.
   *
   * @param track The track to insert.
   * @param index The insertion index.
   */
  public insertTrack(track: Track, index = 0): void {
    this.assertInsertionIndex(index);
    this.insertTracks([track], index);
  }

  /**
   * Moves a track to a specific queue index.
   *
   * @param track The track to move.
   * @param index The destination index.
   */
  public moveTrack(track: TrackResolvable, index = 0): void {
    const tracks = this.tracks.toArray();
    const sourceIndex = tracks.indexOf(track);
    if (sourceIndex === -1) return;
    this.assertInsertionIndex(index);

    const [moved] = tracks.splice(sourceIndex, 1);
    tracks.splice(Math.min(index, tracks.length), 0, moved!);
    this.replaceTracks(tracks);
  }

  /**
   * Copies a track to a specific queue index.
   *
   * @param track The track to copy.
   * @param index The destination index.
   */
  public copyTrack(track: TrackResolvable, index = 0): void {
    this.assertInsertionIndex(index);
    const source = this.tracks.find((item) => item === track);
    if (!source) return;
    this.insertTracks([source], index);
  }

  /**
   * Swaps two tracks in the queue.
   *
   * @param source The first track to swap.
   * @param destination The second track to swap.
   */
  public swapTracks(source: TrackResolvable, destination: TrackResolvable): void {
    const tracks = this.tracks.toArray();
    const sourceIndex = tracks.indexOf(source);
    const destinationIndex = tracks.indexOf(destination);
    if (sourceIndex === -1 || destinationIndex === -1) return;

    [tracks[sourceIndex], tracks[destinationIndex]] = [tracks[destinationIndex]!, tracks[sourceIndex]!];
    this.replaceTracks(tracks);
  }

  private toTracks(track: Track | Queue<Track> | Track[]): Track[] {
    return track instanceof Queue ? track.toArray() : Array.isArray(track) ? track : [track];
  }

  private assertInsertionIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this.tracks.size) {
      throw new RangeError(`Queue index must be an integer between 0 and ${this.tracks.size}.`);
    }
  }

  private insertTracks(tracks: Track[], index: number): void {
    this.assertInsertionIndex(index);
    const queue = this.tracks.toArray();
    queue.splice(index, 0, ...tracks);
    this.replaceTracks(queue);
    if (tracks.length === 1) {
      this.emit(GuildQueueEvents.AudioTrackAdd, tracks[0]!);
    } else {
      this.emit(GuildQueueEvents.AudioTracksAdd, tracks);
    }
  }

  private replaceTracks(tracks: Track[]): void {
    this.tracks.clear();
    this.tracks.merge(tracks);
  }
}
