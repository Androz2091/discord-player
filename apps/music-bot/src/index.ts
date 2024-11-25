/* eslint-disable */
import { Player } from 'discord-player';
import { Client, Events, IntentsBitField } from 'discord.js';
import { PlayCommand } from './play';
import { NowPlayingCommand } from './nowplaying';

const client = new Client({
    // prettier-ignore
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ],
});

const player = Player.create(client);

client.once(Events.ClientReady, async () => {
    await player.extractors.loadDefault();
    console.log('Ready!');
});

client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);

    const command = args.shift();

    try {
        await player.context.provide({ guild: message.guild }, () => {
            switch (command) {
                case 'play':
                    return PlayCommand(message, args);
                case 'np':
                    return NowPlayingCommand(message);
            }
        });
    } catch (e) {
        console.error(e);
        message.channel.send('An error occurred while executing this command.');
    }
});

client.login();
