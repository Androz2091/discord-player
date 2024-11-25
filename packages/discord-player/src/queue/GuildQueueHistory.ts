import { Queue } from '@discord-player/utils';
import { Exceptions } from '../errors';
import { Track } from '../fabric/Track';
import { GuildQueue, TrackSkipReason } from './GuildQueue';

export class GuildQueueHistory<Meta = unknown> {
    public tracks = new Queue<Track>('LIFO');
    public constructor(public queue: GuildQueue<Meta>) {}

    /**
     * Current track in the queue
     */
    public get currentTrack() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.queue.dispatcher?.audioResource?.metadata || ((this.queue as any).__current as Track | null);
    }

    /**
     * Next track in the queue
     */
    public get nextTrack() {
        return this.queue.tracks.at(0) || null;
    }

    /**
     * Previous track in the queue
     */
    public get previousTrack() {
        return this.tracks.at(0) || null;
    }

    /**
     * If history is disabled
     */
    public get disabled() {
        return this.queue.options.disableHistory;
    }

    /**
     * Gets the size of the queue
     */
    public get size() {
        return this.tracks.size;
    }

    public getSize() {
        return this.size;
    }

    /**
     * If history is empty
     */
    public isEmpty() {
        return this.tracks.size < 1;
    }

    /**
     * Add track to track history
     * @param track The track to add
     */
    public push(track: Track | Track[]) {
        if (this.disabled) return false;
        this.tracks.add(track);

        this.resize();

        return true;
    }

    /**
     * Clear history
     */
    public clear() {
        this.tracks.clear();
    }

    /**
     * Play the next track in the queue
     */
    public async next() {
        const track = this.nextTrack;
        if (!track) {
            throw Exceptions.ERR_NO_RESULT('No next track in the queue');
        }

        this.queue.node.skip({
            reason: TrackSkipReason.HistoryNext,
            description: 'Skipped by GuildQueueHistory.next()',
        });
    }

    /**
     * Play the previous track in the queue
     */
    public async previous(preserveCurrent = true) {
        const track = this.tracks.dispatch();
        if (!track) {
            throw Exceptions.ERR_NO_RESULT('No previous track in the queue');
        }

        const current = this.currentTrack;

        await this.queue.node.play(track, { queue: false });
        if (current && preserveCurrent) this.queue.node.insert(current, 0);
    }

    /**
     * Alias to [GuildQueueHistory].previous()
     */
    public back(preserveCurrent = true) {
        return this.previous(preserveCurrent);
    }

    /**
     * Resize history store
     */
    public resize() {
        if (!Number.isFinite(this.queue.maxHistorySize)) return;
        if (this.tracks.store.length < this.queue.maxHistorySize) return;
        this.tracks.store.splice(this.queue.maxHistorySize);
    }
}
