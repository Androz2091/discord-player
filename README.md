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
// add the trackStart event so when a song will be played this message will be sent
client.player.on('trackStart', (message, track) => message.channel.send(`Now playing ${track.title}...`))

client.on("ready", () => {
    console.log("I'm ready !");
});

client.on("message", async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // !play Despacito
    // will play "Despacito" in the member voice channel

    if(command === "play"){
        client.player.play(message, args[0], message.member.user);
        // as we registered the event above, no need to send a success message here
    }

});

client.login(settings.token);
```

## [Documentation](https://discord-player.js.org)

You will find many examples in the documentation to understand how the package works!

### Methods overview

You need to **init the guild queue using the play() function**, then you are able to manage the queue and the music using the following functions. Click on a function name to get an example code and explanations.

#### Play a track

* [play(message, track, requestedBy)](https://discord-player.js.org/Player.html#play) - play a track in a server

#### Check if a track is being played

* [isPlaying(message)](https://discord-player.js.org/Player.html#isPlaying) - check if there is a queue for a specific server

#### Manage the queue

* [getQueue(message)](https://discord-player.js.org/Player.html#getQueue) - get the server queue
* [clearQueue(message)](https://discord-player.js.org/Player.html#clearQueue) - clear the server queue
* [remove(message, track)](https://discord-player.js.org/Player.html#remove) - remove a track from the server queue
* [nowPlaying(message)](https://discord-player.js.org/Player.html#nowPlaying) - get the current track

#### Manage music stream

* [skip(message)](https://discord-player.js.org/Player.html#skip) - skip the current track
* [pause(message)](https://discord-player.js.org/Player.html#pause) - pause the current track
* [resume(message)](https://discord-player.js.org/Player.html#resume) - resume the current track
* [stop(message)](https://discord-player.js.org/Player.html#stop) - stop the current track
* [setFilters(message, newFilters)](https://discord-player.js.org/Player.html#setFilters) - update filters (bassboost for example)
* [setRepeatMode(message, boolean)](https://discord-player.js.org/Player.html#setRepeatMode) - enable or disable repeat mode for the server

### Event messages

```js
// Then add some messages that will be sent when the events will be triggered
client.player

// Send a message when a track starts
.on('trackStart', (message, track) => message.channel.send(`Now playing ${track.title}...`))

// Send a message when something is added to the queue
.on('trackAdd', (message, track) => message.channel.send(`${track.title} has been added to the queue!`))
.on('playlistAdd', (message, playlist) => message.channel.send(`${playlist.title} has been added to the queue (${playlist.items.length} songs)!`))

// Send messages to format search results
.on('searchResults', (message, query, tracks) => {

    const embed = new Discord.MessageEmbed()
    .setAuthor(`Here are your search results for ${query}!`)
    .setDescription(tracks.map((t, i) => `${i}. ${t.title}`))
    .setFooter('Send the number of the song you want to play!')
    message.channel.send(embed);

})
.on('searchInvalidResponse', (message, query, tracks, content, collector) => message.channel.send(`You must send a valid number between 1 and ${tracks.length}!`))
.on('searchCancel', (message, query, tracks) => message.channel.send('You did not provide a valid response... Please send the command again!'))
.on('noResults', (message, query) => message.channel.send(`No results found on YouTube for ${query}!`))

// Send a message when the music is stopped
.on('queueEnd', (message, queue) => message.channel.send('Music stopped as there is no more music in the queue!'))
.on('channelEmpty', (message, queue) => message.channel.send('Music stopped as there is no more member in the voice channel!'))
.on('botDisconnect', (message, queue) => message.channel.send('Music stopped as I have been disconnected from the channel!'))

// Error handling
.on('error', (error, message) => {
    switch(error){
        case 'NotPlaying':
            message.channel.send('There is no music being played on this server!')
            break;
        case 'NotConnected':
            message.channel.send('You are not connected in any voice channel!')
            break;
        case 'UnableToJoin':
            message.channel.send('I am not able to join your voice channel, please check my permissions!')
            break;
        default:
            message.channel.send(`Something went wrong... Error: ${error}`)
    }
})
```

## Examples of bots made with discord-player

These bots are made by the community, they can help you build your own!

* [AtlantaBot](https://github.com/Androz2091/AtlantaBot) by [me](https://github.com/Androz2091)
* [Discord-Music](https://github.com/hydraindia/discord-music) by [hydraindia](https://github.com/hydraindia)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)
