import { player } from '@/lib/discord-player.ts';
import type { EventHandler } from 'commandkit';

const handler: EventHandler<'clientReady'> = async (client) => {
  await player.initialize(client.user.id);
};

export default handler;
