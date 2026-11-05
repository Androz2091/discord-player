import { Collection } from '@discordjs/collection';
import type { DiscordPlayer } from '../player.js';
import type { GuildQueue } from '../structures/guild-queue.js';
import type { Track } from '../structures/track.js';

export class GuildQueueTracksManager<Metadata = any> {
  public readonly player: DiscordPlayer;
  public readonly cache: Collection<string, Track> = new Collection();
  public constructor(public readonly queue: GuildQueue<Metadata>) {
    this.player = queue.manager.player;
  }
}
