import { Client } from "discord.js";
import { Player } from "../src/index";
import { config } from "./config";

const client = new Client({
    intents: ['GUILD_VOICE_STATES', 'GUILD_MESSAGES', 'GUILDS']
});
const player = new Player(client);

player.on("trackStart", (queue, track) => console.log(`Now playing: ${track.title} in ${queue.guild.name}!`));

client.on("ready", () => console.log("Bot is online!"));

client.on("message", async message => {
    if (!client.application.owner) await client.application.fetch();
    if (message.author.id !== client.application.owner.id) return;

    if (message.content.startsWith("!np") && message.guild.me.voice.channelID) {
        const conn = player.getQueue(message.guild.id);
        if (!conn) return;
        return void message.channel.send(`Now Playing: **${conn.current.title}** (Played **${Math.floor(conn.connection.streamTime / 1000)} seconds**)`);
    }
    if (message.content.startsWith("!p") && message.member.voice.channelID) {
        const queue = player.createQueue(message.guild);
        const song = await player.search(message.content.slice(2).trim(), message.author).then(x => x[0]);

        if (!queue.connection) {
            queue.connect(message.member.voice.channel)
                .then(async q => {
                    await q.play(song);
                });
        }
    }
});

client.login(config.token);