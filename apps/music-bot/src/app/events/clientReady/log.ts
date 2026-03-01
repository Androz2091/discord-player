import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';
import { useMainPlayer } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

const handler: EventHandler<'clientReady'> = async (client) => {
  const player = useMainPlayer();
  await player.extractors.loadMulti(DefaultExtractors);

  // eslint-disable-next-line no-console
  Logger.info(`Logged in as ${client.user.username}!`);
  Logger.log`${player.scanDeps()}`;
};

export default handler;
