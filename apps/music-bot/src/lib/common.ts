import type { TextBasedChannel } from 'discord.js';

export interface QueueMetadata {
  textChannel: TextBasedChannel;
}

export interface CustomMetadata {
  url: string;
  playedBy: {
    name: string;
    id: string;
    avatar: string;
  };
}
