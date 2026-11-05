import type { DiscordPlayer } from '../player.js';
import type { GuildQueue } from '../structures/guild-queue.js';
import type { Track } from '../structures/track.js';
import { Stack } from '../utils/stack.js';

export class GuildQueueHistoryManager<Metadata = any> {
  public readonly player: DiscordPlayer;
  public readonly tracks: Stack<Track>;

  public constructor(public readonly queue: GuildQueue<Metadata>) {
    this.player = queue.manager.player;
    this.tracks = new Stack(this.queue.options.maxHistorySize ?? 50);
  }
}
