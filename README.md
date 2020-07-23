# Discord Player

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![patreonBadge](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2FAndroz2091%2Fpledges&style=for-the-badge)](https://patreon.com/Androz2091)

**Note**: this module uses recent discordjs features and requires discord.js version 12.

Discord Player is a powerful [Node.js](https://nodejs.org) module that allows you to easily implement music commands. **Everything** is customizable, and everything is done to simplify your work **without limiting you**! It doesn't require any api key, as it uses **scraping**.

## Installation

```sh
npm install --save discord-player
```

Install **@discordjs/opus**:

```sh
npm install --save @discordjs/opus
```

Install [FFMPEG](https://www.ffmpeg.org/download.html) and you're done!

## Features

🤘 Easy to use!  
🎸 You can apply some cool filters (bassboost, reverse, 8D, etc...)  
🎼 Manage your server queues with simple functions (add songs, skip the current song, pause the music, resume it, etc...)!  
🌐 Multi-servers support

## Getting Started

Here is the code you will need to get started with discord-player. Then, you will be able to use `client.player` everywhere in your code!

```js
const Discord = require("discord.js"),
client = new Discord.Client(),
settings = {
    prefix: "!",
    token: "Your Discord Token"
};

const { Player } = require("discord-player");
// Create a new Player (you don't need any API Key)
const player = new Player(client);
// To easily access the player
client.player = player;

client.on("ready", () => {
    console.log("I'm ready !");
});

client.on("message", async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // !play Despacito
    // will play "Despacito" in the member voice channel

    if(command === "play"){
        let track = await client.player.play(message.member.voice.channel, args[0], message.member.user.tag);
        message.channel.send(`Currently playing ${track.name}! - Requested by ${track.requestedBy}`);
    }

});

client.login(settings.token);
```

## [Documentation](https://discord-player.js.org)

You will find many examples in the documentation to understand how the package works!

### Methods overview

You need to **init the guild queue using the play() function**, then you are able to manage the queue and the music using the following functions. Click on a function name to get an example code and explanations.

#### Queue initialization

* [play(voiceChannel, track, requestedBy)](https://discord-player.js.org/Player.html#play) - play a track in a server

#### Queue management

* [isPlaying(guildID)](https://discord-player.js.org/Player.html#isPlaying) - check if there is a queue for a specific server

#### Manage tracks in your queue

* [getQueue(guildID)](https://discord-player.js.org/Player.html#getQueue) - get the server queue
* [addToQueue(guildID, track, requestedBy)](https://discord-player.js.org/Player.html#addToQueue) - add a track to the server queue
* [clearQueue(guildID)](https://discord-player.js.org/Player.html#clearQueue) - clear the server queue
* [remove(guildID, track)](https://discord-player.js.org/Player.html#remove) - remove a track from the server queue
* [nowPlaying(guildID)](https://discord-player.js.org/Player.html#nowPlaying) - get the current track

#### Manage music stream

* [skip(guildID)](https://discord-player.js.org/Player.html#skip) - skip the current track
* [pause(guildID)](https://discord-player.js.org/Player.html#pause) - pause the current track
* [resume(guildID)](https://discord-player.js.org/Player.html#resume) - resume the current track
* [stop(guildID)](https://discord-player.js.org/Player.html#stop) - stop the current track
* [setFilters(guildID, newFilters)](https://discord-player.js.org/Player.html#setFilters) - update filters (bassboost for example)
* [setRepeatMode(guildID, boolean)](https://discord-player.js.org/Player.html#setRepeatMode) - enable or disable repeat mode for the server

### Event messages

```js
// Play the music
await client.player.play(message.member.voice.channel, "Despacito")

// Then add some messages that will be sent when the events will be triggered
client.player.getQueue(message.guild.id)
.on('end', () => {
    message.channel.send('There is no more music in the queue!');
})
.on('trackChanged', (oldTrack, newTrack) => {
    message.channel.send(`Now playing ${newTrack.name}...`);
})
.on('channelEmpty', () => {
    message.channel.send('Stop playing, there is no more member in the voice channel...');
});
```

## Examples of bots made with discord-player

These bots are made by the community, they can help you build your own!

* [Discord-Music](https://github.com/hydraindia/discord-music) by [hydraindia](https://github.com/hydraindia)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)
