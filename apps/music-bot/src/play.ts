import { Message } from 'discord.js';
import { useMainPlayer } from 'discord-player';

export const PlayCommand = async (message: Message, args: string[]) => {
    const player = useMainPlayer();

    const channel = message.member?.voice.channel;

    if (!channel) {
        return message.channel.send('You must be in a voice channel to use this command.');
    }

    const query = args.join(' ');

    const result = await player.play(channel, query, {
        nodeOptions: {
            metadata: {
                channel: message.channel,
            },
        },
    });

    await message.channel.send(`Playing ${result.track} in ${channel}`);
};
