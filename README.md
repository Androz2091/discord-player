# Discord Player
Complete framework to facilitate music commands using **[discord.js](https://discord.js.org)**.

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![discordBadge](https://img.shields.io/discord/558328638911545423?style=for-the-badge&color=7289da)](https://androz2091.fr/discord)
[![wakatime](https://wakatime.com/badge/github/Androz2091/discord-player.svg)](https://wakatime.com/badge/github/Androz2091/discord-player)
[![CodeFactor](https://www.codefactor.io/repository/github/androz2091/discord-player/badge/v5)](https://www.codefactor.io/repository/github/androz2091/discord-player/overview/v5)

## Installation

### Install **[discord-player](https://npmjs.com/package/discord-player)**

```sh
$ npm install --save discord-player
```

### Install **[@discordjs/opus](https://npmjs.com/package/@discordjs/opus)**

```sh
$ npm install --save @discordjs/opus
```

### Install FFmpeg or Avconv
- Official FFMPEG Website: **[https://www.ffmpeg.org/download.html](https://www.ffmpeg.org/download.html)**

- Node Module (FFMPEG): **[https://npmjs.com/package/ffmpeg-static](https://npmjs.com/package/ffmpeg-static)**

- Avconv: **[https://libav.org/download](https://libav.org/download)**

# Features
- Simple & easy to use 🤘
- Beginner friendly 😱
- Audio filters 🎸
- Lightweight 🛬
- Custom extractors support 🌌
- Lyrics 📃
- Multiple sources support ✌
- Play in multiple servers at the same time 🚗

## [Documentation](https://discord-player.js.org)

## Getting Started

First of all, you will need to register slash commands:

```js
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const commands = [{
    name: "play",
    description: "Plays a song!",
    options: [
        {
            name: "query",
            type: "STRING",
            description: "The song you want to play",
            required: true
        }
    ]
}]; 

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application [/] commands.");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log("Successfully reloaded application [/] commands.");
  } catch (error) {
    console.error(error);
  }
})();
```

Now you can implement your bot's logic:

```js
const { Client, Intents } = require("discord.js");
const client = new Discord.Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { Player } = require("discord-player");

// Create a new Player (you don't need any API Key)
const player = new Player(client);

// add the trackStart event so when a song will be played this message will be sent
player.on("trackStart", (queue, track) => queue.metadata.channel.send(`🎶 | Now playing **${track.title}**!`))

client.once("ready", () => {
    console.log("I'm ready !");
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    // /play Despacito
    // will play "Despacito" in the voice channel
    if (interaction.commandName === "play") {
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.reply({ content: "You are not in my voice channel!", ephemeral: true });
        const query = interaction.options.get("query").value;
        const queue = player.createQueue(interaction.guild, {
            metadata: {
                channel: interaction.channel
            }
        });
        
        // verify vc connection
        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            queue.destroy();
            return await interaction.reply({ content: "Could not join your voice channel!", ephemeral: true });
        }

        await interaction.deferReply();
        const track = await player.search(query, {
            requestedBy: interaction.user
        }).then(x => x.tracks[0]);
        if (!track) return await interaction.followUp({ content: `❌ | Track **${query}** not found!` });

        queue.play(track);

        return await interaction.followUp({ content: `⏱️ | Loading track **${track.title}**!` });
    }
});

client.login(process.env.DISCORD_TOKEN);
```

## Supported websites

By default, discord-player supports **YouTube**, **Spotify** and **SoundCloud** streams only.

### Optional dependencies

Discord Player provides an **Extractor API** that enables you to use your custom stream extractor with it. Some packages have been made by the community to add new features using this API.

#### [@discord-player/extractor](https://github.com/Snowflake107/discord-player-extractors) (optional)

Optional package that adds support for `vimeo`, `reverbnation`, `facebook`, `attachment links` and `lyrics`.
You just need to install it using `npm i --save @discord-player/extractor` (discord-player will automatically detect and use it).

#### [@discord-player/downloader](https://github.com/DevSnowflake/discord-player-downloader) (optional)

`@discord-player/downloader` is an optional package that brings support for +700 websites. The documentation is available [here](https://github.com/DevSnowflake/discord-player-downloader).

## Examples of bots made with Discord Player

These bots are made by the community, they can help you build your own!

* **[Discord Music Bot](https://github.com/Androz2091/discord-music-bot)** by [Androz2091](https://github.com/Androz2091)
* [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [Androz2091](https://github.com/Androz2091) (**outdated**)
* [Discord-Music](https://github.com/inhydrox/discord-music) by [inhydrox](https://github.com/inhydrox) (**outdated**)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev) (**outdated**)

## Advanced

### Use cookies

```js
const player = new Player(client, {
    ytdlOptions: {
        requestOptions: {
            headers: {
                cookie: "YOUR_YOUTUBE_COOKIE"
            }
        }
    }
});
```

### Use custom proxies

```js
const HttpsProxyAgent = require("https-proxy-agent");

// Remove "user:pass@" if you don't need to authenticate to your proxy.
const proxy = "http://user:pass@111.111.111.111:8080";
const agent = HttpsProxyAgent(proxy);

const player = new Player(client, {
    ytdlOptions: {
        requestOptions: { agent }
    }
});
```
