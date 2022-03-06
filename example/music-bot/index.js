require("dotenv").config({
    path: __dirname+"/.env"
});
const { Client, GuildMember, Intents } = require("discord.js");
const config = require("./config");
const { Player, QueryType, QueueRepeatMode } = require("discord-player");
const client = new Client({
    intents: [Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILDS]
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
const player = new Player(client, {
    ytdlOptions: {
        headers: {
            cookie: process.env.YT_COOKIE
        }
    }
});

player.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the queue: ${error.message}`);
});
player.on("connectionError", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

player.on("trackStart", (queue, track) => {
    queue.metadata.send(`🎶 | Started playing: **${track.title}** in **${queue.connection.channel.name}**!`);
});

player.on("trackAdd", (queue, track) => {
    queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
});

player.on("botDisconnect", (queue) => {
    queue.metadata.send("❌ | I was manually disconnected from the voice channel, clearing queue!");
});

player.on("channelEmpty", (queue) => {
    queue.metadata.send("❌ | Nobody is in the voice channel, leaving...");
});

player.on("queueEnd", (queue) => {
    queue.metadata.send("✅ | Queue finished!");
});

client.on("messageCreate", async (message) => {
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
                                value: QueueRepeatMode.OFF
                            },
                            {
                                name: "Track",
                                value: QueueRepeatMode.TRACK
                            },
                            {
                                name: "Queue",
                                value: QueueRepeatMode.QUEUE
                            },
                            {
                                name: "Autoplay",
                                value: QueueRepeatMode.AUTOPLAY
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
            },
            {
                name: "bassboost",
                description: "Toggles bassboost filter"
            },
            {
                name: "ping",
                description: "Shows bot latency"
            }
        ]);

        await message.reply("Deployed!");
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() || !interaction.guildId) return;

    if (interaction.commandName === "ping") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guild);

        return void interaction.followUp({
            embeds: [
                {
                    title: "⏱️ | Latency",
                    fields: [
                        { name: "Bot Latency", value: `\`${Math.round(client.ws.ping)}ms\`` },
                        { name: "Voice Latency", value: !queue ? "N/A" : `UDP: \`${queue.connection.voiceConnection.ping.udp ?? "N/A"}\`ms\nWebSocket: \`${queue.connection.voiceConnection.ping.ws ?? "N/A"}\`ms` }
                    ],
                    color: 0xFFFFFF
                }
            ]
        });
    }

    if (!(interaction.member instanceof GuildMember) || !interaction.member.voice.channel) {
        return void interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
    }

    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
        return void interaction.reply({ content: "You are not in my voice channel!", ephemeral: true });
    }

    if (interaction.commandName === "play" || interaction.commandName === "soundcloud") {
        await interaction.deferReply();

        const query = interaction.options.get("query").value;
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: interaction.commandName === "soundcloud" ? QueryType.SOUNDCLOUD_SEARCH : QueryType.AUTO
            })
            .catch(() => {});
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "No results were found!" });

        const queue = await player.createQueue(interaction.guild, {
            metadata: interaction.channel
        });

        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildId);
            return void interaction.followUp({ content: "Could not join your voice channel!" });
        }

        await interaction.followUp({ content: `⏱ | Loading your ${searchResult.playlist ? "playlist" : "track"}...` });
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0]);
        if (!queue.playing) await queue.play();
    } else if (interaction.commandName === "volume") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const vol = interaction.options.get("amount");
        if (!vol) return void interaction.followUp({ content: `🎧 | Current volume is **${queue.volume}**%!` });
        if ((vol.value) < 0 || (vol.value) > 100) return void interaction.followUp({ content: "❌ | Volume range must be 0-100" });
        const success = queue.setVolume(vol.value);
        return void interaction.followUp({
            content: success ? `✅ | Volume set to **${vol.value}%**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "skip") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const currentTrack = queue.current;
        const success = queue.skip();
        return void interaction.followUp({
            content: success ? `✅ | Skipped **${currentTrack}**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "queue") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const currentTrack = queue.current;
        const tracks = queue.tracks.slice(0, 10).map((m, i) => {
            return `${i + 1}. **${m.title}** ([link](${m.url}))`;
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
                    fields: [{ name: "Now Playing", value: `🎶 | **${currentTrack.title}** ([link](${currentTrack.url}))` }]
                }
            ]
        });
    } else if (interaction.commandName === "pause") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const paused = queue.setPaused(true);
        return void interaction.followUp({ content: paused ? "⏸ | Paused!" : "❌ | Something went wrong!" });
    } else if (interaction.commandName === "resume") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const paused = queue.setPaused(false);
        return void interaction.followUp({ content: !paused ? "❌ | Something went wrong!" : "▶ | Resumed!" });
    } else if (interaction.commandName === "stop") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        queue.destroy();
        return void interaction.followUp({ content: "🛑 | Stopped the player!" });
    } else if (interaction.commandName === "np") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const progress = queue.createProgressBar();
        const perc = queue.getPlayerTimestamp();

        return void interaction.followUp({
            embeds: [
                {
                    title: "Now Playing",
                    description: `🎶 | **${queue.current.title}**! (\`${perc.progress}%\`)`,
                    fields: [
                        {
                            name: "\u200b",
                            value: progress
                        }
                    ],
                    color: 0xffffff
                }
            ]
        });
    } else if (interaction.commandName === "loop") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const loopMode = interaction.options.get("mode").value;
        const success = queue.setRepeatMode(loopMode);
        const mode = loopMode === QueueRepeatMode.TRACK ? "🔂" : loopMode === QueueRepeatMode.QUEUE ? "🔁" : "▶";
        return void interaction.followUp({ content: success ? `${mode} | Updated loop mode!` : "❌ | Could not update loop mode!" });
    } else if (interaction.commandName === "bassboost") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        await queue.setFilters({
            bassboost: !queue.getFiltersEnabled().includes("bassboost"),
            normalizer2: !queue.getFiltersEnabled().includes("bassboost") // because we need to toggle it with bass
        });

        return void interaction.followUp({ content: `🎵 | Bassboost ${queue.getFiltersEnabled().includes("bassboost") ? "Enabled" : "Disabled"}!` });
    } else {
        interaction.reply({
            content: "Unknown command!",
            ephemeral: true
        });
    }
});

client.login(config.token);
