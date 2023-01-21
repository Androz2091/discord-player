import { Queue } from '@discord-player/utils';
import Track from '../Track';
import { GuildQueue } from './GuildQueue';

export class GuildQueueHistory<Meta = unknown> {
    public tracks = new Queue<Track>('LIFO');
    public constructor(public queue: GuildQueue<Meta>) {}

    public get currentTrack() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.queue.dispatcher?.audioResource?.metadata || ((this.queue as any).__current as Track | null);
    }

    public get nextTrack() {
        return this.queue.tracks.at(0) || null;
    }

    public get previousTrack() {
        return this.tracks.at(0) || null;
    }

    public get disabled() {
        return this.queue.options.disableHistory;
    }

    public isEmpty() {
        return this.tracks.size < 1;
    }

    public push(track: Track | Track[]) {
        if (this.disabled) return false;
        this.tracks.add(track);
        return true;
    }

    public clear() {
        this.tracks.clear();
    }

    public next() {
        const track = this.nextTrack;
        if (!track) {
            throw new Error('No next track in the queue');
        }

        this.queue.node.skip();
    }

    public previous() {
        const track = this.previousTrack;
        if (!track) {
            throw new Error('No previous track in the queue');
        }

        this.queue.node.play(track, { queue: true });
        this.queue.node.skip();
    }
}
