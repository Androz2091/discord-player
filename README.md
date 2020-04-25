# Discord Player

[![downloadsBadge](https://img.shields.io/npm/dt/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![versionBadge](https://img.shields.io/npm/v/discord-player?style=for-the-badge)](https://npmjs.com/discord-player)
[![patreonBadge](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2FAndroz2091%2Fpledges&style=for-the-badge)](https://patreon.com/Androz2091)

**Note**: this module uses recent discordjs features and requires discord.js version 12.

Discord Player is a powerful [Node.js](https://nodejs.org) module that allows you to easily implement music commands. **Everything** is customizable, and everything is done to simplify your work **without limiting you**!

## Installation

```sh
npm install --save discord-player
```

Install **opusscript** or **@discordjs/opus**:
```sh
npm install --save opusscript
```

Install [FFMPEG](https://www.ffmpeg.org/download.html) and you're done!

## Player

```js
const Discord = require("discord.js"),
client = new Discord.Client(),
settings = {
    prefix: "!",
    token: "Your Discord Token"
};

const { Player } = require("discord-player");
// Create a new Player (Youtube API key is your Youtube Data v3 key)
const player = new Player(client, "YOUTUBE API KEY");
// To easily access the player
client.player = player;

client.on("ready", () => {
    console.log("I'm ready !");
});

client.login(settings.token);
```

You can pass a third parameter when instantiating the class Player: the **options** object:  
**options.leaveOnEnd**: whether the bot should leave the voice channel when there is no more song in the queue.  
**options.leaveOnStop**: whether the bot should leave the voice channel when the `stop()` function is used.  
**options.leaveOnEmpty**: whether the bot should leave the voice channel if there is no more member in it.

### Features Overview

You need to **init the guild queue using the play() function**, then you are able to manage the queue using the following functions:

```js
// Play a song in the voice channel and init the guild queue
client.player.play(voiceChannel, songName);

// Add a song to the queue
client.player.addToQueue(guildID, songName);
// Clear the queue
client.player.clearQueue(guildID);
// Get the queue
client.player.getQueue(guildID);
// Skip the current song
client.player.skip(guildID);


// Pause
client.player.pause(guildID);
// Resume
client.player.resume(guildID);
// Stop
client.player.stop(guildID);

// Check if music is playing in a guild
client.player.isPlaying(guildID);
// Get the currently playing song
client.player.nowPlaying(guildID);


// Current song will be repeated indefinitely
client.player.setRepeatMode(guildID, true);
// Current song will no longer be repeated indefinitely
client.player.setRepeatMode(guildID, false);
```

### Event messages

```js
client.player.getQueue(guildID)
.on('end', () => {
    message.channel.send('There is no more music in the queue!');
})
.on('songChanged', (oldSong, newSong) => {
    message.channel.send(`Now playing ${newSong.name}...`);
})
.on('channelEmpty', () => {
    message.channel.send('Stop playing, there is no more member in the voice channel...');
});
```

## Examples

### Play

To play a song, use the `client.player.play()` function.  

**Usage:**

```js
client.player.play(voiceChannel, songName);
```

**Example**:
```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    
    // !play Despacito
    // will play "Despacito" in the member voice channel

    if(command === 'play'){
        let song = await client.player.play(message.member.voice.channel, args[0])
        message.channel.send(`Currently playing ${song.name}!`);
    }

```

### Pause

To pause the current song, use the `client.player.pause()` function.  

**Usage:**

```js
client.player.pause(guildID);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'pause'){
        let song = await client.player.pause(message.guild.id);
        message.channel.send(`${song.name} paused!`);
    }

});
```

### Resume

To resume the current song, use the `client.player.resume()` function.  

**Usage:**

```js
client.player.resume(guildID);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'resume'){
        let song = await client.player.resume(message.guild.id);
        message.channel.send(`${song.name} resumed!`);
    }

});
```

### Stop

To stop the music, use the `client.player.stop()` function.  

**Usage:**

```js
client.player.stop(guildID);
```

**Example**:

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'stop'){
        client.player.stop(message.guild.id);
        message.channel.send('Music stopped!');
    }

});
```

### SetVolume

To update the volume, use the `client.player.setVolume()` function.  

**Usage:**

```js
client.player.setVolume(guildID, percent);
```

**Example**:

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'setvolume'){
        client.player.setVolume(message.guild.id, parseInt(args[0]));
        message.channel.send(`Volume set to ${args[0]} !`);
    }

});
```

### AddToQueue

To add a song to the queue, use the `client.player.addToQueue()` function.

**Usage:**

```js
client.player.addToQueue(guildID, songName);
```

**Example:**

In this example, you will see how to add a song to the queue if one is already playing.

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'play'){
        let aSongIsAlreadyPlaying = client.player.isPlaying(message.guild.id);
        // If there's already a song playing 
        if(aSongIsAlreadyPlaying){
            // Add the song to the queue
            let song = await client.player.addToQueue(message.guild.id, args[0]);
            message.channel.send(`${song.name} added to queue!`);
        } else {
            // Else, play the song
            let song = await client.player.play(message.member.voice.channel, args[0]);
            message.channel.send(`Currently playing ${song.name}!`);
        }
    }

});
```

### ClearQueue

To clear the queue, use the `client.player.clearQueue()` function.

**Usage:**

```js
client.player.clearQueue(guildID);
```

**Example:**

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'clear-queue'){
        client.player.clearQueue(message.guild.id);
        message.channel.send('Queue cleared!');
    }

});
```

### GetQueue

To get the server queue, use the `client.player.getQueue()` function.

**Usage:**

```js
client.player.getQueue(guildID);
```

**Example:**

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'queue'){
        let queue = await client.player.getQueue(message.guild.id);
        message.channel.send('Server queue:\n'+(queue.songs.map((song, i) => {
            return `${i === 0 ? 'Current' : `#${i+1}`} - ${song.name} | ${song.author}`
        }).join('\n')));
    }

    /**
     * Output:
     * 
     * Server queue:
     * Current - Despacito | Luis Fonsi
     * #2 - Memories | Maroon 5
     * #3 - Dance Monkey | Tones And I
     * #4 - Circles | Post Malone
     */

});
```

### Skip

To skip the current song, use the `client.player.skip()` function.  

**Usage:**

```js
client.player.skip(guildID);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'skip'){
        let song = await client.player.skip(message.guild.id);
        message.channel.send(`${song.name} skipped!`);
    }

});
```

### Now Playing

To get the currently playing song, use the `client.player.nowPlaying()` function.  

**Usage:**

```js
client.player.nowPlaying(guildID);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'now-playing'){
        let song = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`Currently playing ${song.name}...`);
    }

});
```

### Repeat

To repeat the current song, use the `client.player.setRepeatMode()` function.  

**Usage:**

```js
client.player.setRepeatMode(guildID, boolean);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'enable-repeat'){
        // Enable repeat mode
        client.player.setRepeatMode(message.guild.id, true);
        // Get the current song
        let song = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`${song.name} will be repeated indefinitely!`);
    }

    if(command === 'disable-repeat'){
        // Disable repeat mode
        client.player.setRepeatMode(message.guild.id, false);
        // Get the current song
        let song = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`${song.name}  will no longer be repeated indefinitely!`);
    }

});
```

## Info Messages

You can send a message when the queue ends or when the song changes:
```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'play'){
        let song = await client.player.play(message.member.voice.channel, args[0]);
        song.queue.on('end', () => {
            message.channel.send('The queue is empty, please add new songs!');
        });
        song.queue.on('songChanged', (oldSong, newSong, skipped, repeatMode) => {
            if(repeatMode){
                message.channel.send(`Playing ${newSong} again...`);
            } else {
                message.channel.send(`Now playing ${newSong}...`);
            }
        });
    }

```

## Handle errors

There are 2 main errors that you can handle like this:

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // Error 1:
    // Song not found
    if(command === 'play'){
        client.player.play(message.member.voice.channel, args[0]).then((song) => {
            message.channel.send(`Currently playing ${song.name}!`);
        }).catch(() => {
            message.channel.send(`No song found for ${args[0]}`);
        });
    }

    // Error 2:
    // Not playing
    if(command === 'queue'){
        let playing = client.player.isPlaying(message.guild.id);
        if(!playing) return message.channel.send(':x: No songs currently playing!');
        // you are sure it works:
        client.player.getQueue(message.guild.id);
    }

});
```

## Examples of bots made with discord-player

These bots are made by the community, they can help you build your own!

* [Discord-Music](https://github.com/hydraindia/discord-music) by [hydraindia](https://github.com/hydraindia)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)

