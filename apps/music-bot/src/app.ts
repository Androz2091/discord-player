import { Client, Events, IntentsBitField } from 'discord.js';
import { player } from './lib/discord-player.ts';

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildVoiceStates],
});

client.on(Events.Raw, (payload) => player.receive(payload));

export default client;
