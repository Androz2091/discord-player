import type { GuildQueue } from 'discord-player';
import { DiscordPlayer } from 'discord-player';
import { useClient } from 'commandkit/hooks';
import type { CustomMetadata, QueueMetadata } from './common.ts';

export const player = new DiscordPlayer({
  nodes: [
    {
      id: 'local',
      type: 'embedded',
    },
  ],
  send(guildId, payload) {
    const client = useClient<true>();
    client.guilds.cache.get(guildId)?.shard?.send(payload);
  },
});

player.events.on('playerStart', async (queue: GuildQueue<QueueMetadata>, event) => {
  const channel = queue.metadata.textChannel;
  if (!channel.isSendable()) return;
  const metadata = event.customMetadata as CustomMetadata;
  await channel.send(`Now playing: **[${event.info.metadata?.title || 'Unknown'}](<${metadata.url}>)**`);
});

player.events.on('playerFinish', async (queue: GuildQueue<QueueMetadata>, event) => {
  const channel = queue.metadata.textChannel;
  if (!channel.isSendable()) return;
  const metadata = event.customMetadata as CustomMetadata | undefined;
  await channel.send(`Finished playing the track: **[${'Unknown Track'}](<${metadata?.url}>)**.`);
});

player.events.on('playerError', async (queue: GuildQueue<QueueMetadata>, event) => {
  const channel = queue.metadata.textChannel;
  if (!channel.isSendable()) return;
  const metadata = event.customMetadata as CustomMetadata | undefined;
  await channel.send(
    `An error occurred while playing **[${'Unknown Track'}](<${metadata?.url}>)**: ${event.error.message}`,
  );
});
