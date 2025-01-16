import { DefaultExtractors } from '@discord-player/extractor';
import { useMainPlayer } from 'discord-player';
import { Client } from 'discord.js';

export default async function (client: Client<true>) {
  const player = useMainPlayer();
  await player.extractors.loadMulti(DefaultExtractors);

  // eslint-disable-next-line no-console
  console.log(`Logged in as ${client.user?.tag}!`);
}
