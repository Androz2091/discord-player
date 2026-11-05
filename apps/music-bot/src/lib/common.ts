import type { TextBasedChannel } from 'discord.js' with { 'resolution-mode': 'require' };

/** Notification destination retained for the lifetime of a guild queue. */
export interface QueueMetadata {
  /** Channel that receives public queue and playback embeds. */
  textChannel: TextBasedChannel;
}
