import { Client, GuildMember, Message, TextChannel } from "discord.js";
import { Player, Queue, Track } from "../src/index";
import { QueryType, QueueRepeatMode } from "../src/types/types";
import { config } from "./config";
// use this in prod.
// import { Player, Queue } from "discord-player";

const client = new Client({
    intents: ["GUILD_VOICE_STATES", "GUILD_MESSAGES", "GUILDS"]
});

client.on("ready", () => {
    console.log("Bot is online!");
    client.user.setActivity({
        name: "🎶 | Music Time",
        type: "LISTENING"
    });
});
client.on("error", console.error);
client.on("warn", console.warn);

// instantiate the player
const player = new Player(client);

player.on("error", console.error);

player.on("trackStart", (queue, track) => {
    const guildQueue = queue as Queue<TextChannel>;
    guildQueue.metadata.send(`🎶 | Started playing: **${track.title}** in **${guildQueue.connection.channel.name}**!`);
});

player.on("trackAdd", (queue, track) => {
    const guildQueue = queue as Queue<TextChannel>;
    guildQueue.metadata.send(`🎶 | Track **${track.title}** queued!`);
});

client.on("message", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === "!deploy" && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: "play",
                description: "Plays a song from youtube",
                options: [
                    {
                        name: "query",
                        type: "STRING",
                        description: "The song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "soundcloud",
                description: "Plays a song from soundcloud",
                options: [
                    {
                        name: "query",
                        type: "STRING",
                        description: "The song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "volume",
                description: "Sets music volume",
                options: [
                    {
                        name: "amount",
                        type: "INTEGER",
                        description: "The volume amount to set (0-100)",
                        required: false
                    }
                ]
            },
            {
                name: "loop",
                description: "Sets loop mode",
                options: [
                    {
                        name: "mode",
                        type: "INTEGER",
                        description: "Loop type",
                        required: true,
                        choices: [
                            {
                                name: "Off",
                                value: 0
                            },
                            {
                                name: "Track",
                                value: 1
                            },
                            {
                                name: "Queue",
                                value: 2
                            }
                        ]
                    }
                ]
            },
            {
                name: "skip",
                description: "Skip to the current song"
            },
            {
                name: "queue",
                description: "See the queue"
            },
            {
                name: "pause",
                description: "Pause the current song"
            },
            {
                name: "resume",
                description: "Resume the current song"
            },
            {
                name: "stop",
                description: "Stop the player"
            },
            {
                name: "np",
                description: "Now Playing"
            }
        ]);

        await message.reply("Deployed!");
    }
});

client.on("interaction", async (interaction) => {
    if (!interaction.isCommand() || !interaction.guildID) return;

    if (!(interaction.member instanceof GuildMember) || !interaction.member.voice.channel) {
        return void interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
    }

    if (interaction.guild.me.voice.channelID && interaction.member.voice.channelID !== interaction.guild.me.voice.channelID) {
        return void interaction.reply({ content: "You are not in my voice channel!", ephemeral: true });
    }

    if (interaction.commandName === "play" || interaction.commandName === "soundcloud") {
        await interaction.defer();

        const query = interaction.options.get("query")!.value! as string;
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: interaction.commandName === "soundcloud" ? QueryType.SOUNDCLOUD_SEARCH : QueryType.AUTO
            })
            .catch(() => {});
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "No results were found!" });

        const queue = await player.createQueue(interaction.guild, {
            metadata: interaction.channel as TextChannel
        });

        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildID);
            return void interaction.followUp({ content: "Could not join your voice channel!" });
        }

        await interaction.followUp({ content: "⏱ | Loading your track..." });
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0]);
        if (!queue.playing) await queue.play();
    } else if (interaction.commandName === "volume") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const vol = interaction.options.get("amount");
        if (!vol) return void interaction.followUp({ content: `🎧 | Current volume is **${queue.volume}**%!` });
        if ((vol.value as number) < 0 || (vol.value as number) > 100) return void interaction.followUp({ content: "❌ | Volume range must be 0-100" });
        const success = queue.setVolume(vol.value as number);
        return void interaction.followUp({
            content: success ? `✅ | Volume set to **${vol.value}%**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "skip") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const currentTrack = queue.current;
        const success = queue.skip();
        return void interaction.followUp({
            content: success ? `✅ | Skipped **${currentTrack}**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "queue") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const currentTrack = queue.current;
        const tracks = queue.tracks.slice(0, 10).map((m, i) => {
            return `${i + 1}. **${m.title}**`;
        });

        return void interaction.followUp({
            embeds: [
                {
                    title: "Server Queue",
                    description: `${tracks.join("\n")}${
                        queue.tracks.length > tracks.length
                            ? `\n...${queue.tracks.length - tracks.length === 1 ? `${queue.tracks.length - tracks.length} more track` : `${queue.tracks.length - tracks.length} more tracks`}`
                            : ""
                    }`,
                    color: 0xff0000,
                    fields: [{ name: "Now Playing", value: `🎶 | **${currentTrack.title}**` }]
                }
            ]
        });
    } else if (interaction.commandName === "pause") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const success = queue.setPaused(true);
        return void interaction.followUp({ content: success ? "⏸ | Paused!" : "❌ | Something went wrong!" });
    } else if (interaction.commandName === "resume") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const success = queue.setPaused(false);
        return void interaction.followUp({ content: success ? "▶ | Resumed!" : "❌ | Something went wrong!" });
    } else if (interaction.commandName === "stop") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        queue.destroy();
        return void interaction.followUp({ content: "🛑 | Stopped the player!" });
    } else if (interaction.commandName === "np") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        return void interaction.followUp({ content: `🎶 | Current song: **${queue.current.title}**!` });
    } else if (interaction.commandName === "loop") {
        await interaction.defer();
        const queue = player.getQueue(interaction.guildID);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const loopMode = interaction.options.get("mode")!.value as QueueRepeatMode;
        const success = queue.setRepeatMode(loopMode);
        const mode = loopMode === QueueRepeatMode.TRACK ? "🔂" : loopMode === QueueRepeatMode.QUEUE ? "🔁" : "▶";
        return void interaction.followUp({ content: success ? `${mode} | Updated loop mode!` : "❌ | Could not update loop mode!" });
    } else {
        interaction.reply({
            content: "Unknown command!",
            ephemeral: true
        });
    }
});

client.login(config.token);
