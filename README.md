# Discord Music

[![downloadsBadge](https://img.shields.io/npm/dt/discord-music?style=for-the-badge)](https://npmjs.com/discord-music)
[![versionBadge](https://img.shields.io/npm/v/discord-music?style=for-the-badge)](https://npmjs.com/discord-music)
[![patreonBadge](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2FAndroz2091%2Fpledges&style=for-the-badge)](https://patreon.com/Androz2091)

**Note**: this module uses recent discordjs features and requires discord.js version 12.

Discord Music is a powerful [Node.js](https://nodejs.org) module that allows you to easily implement music commands. Everything is customizable, and everything is done to simplify your work without limiting you!

- [Installation](#installation)
- [Player](#player)
  - [Play](#play)
  - [Pause](#pause)
  - [Resume](#resume)
  - [Stop](#stop)
  - [SetVolume](#setvolume)
  - [AddToQueue](#addtoqueue)
  - [ClearQueue](#clearqueue)
  - [GetQueue](#getqueue)
- [Info Messages](#info-messages)
- [Handle errors](#handle-errors)

## Installation

```sh
npm install --save discord-music
```

Install **opusscript** or **node-opus**:
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

const { Player } = require('discord-music');
const player = new Player(client, "YOUTUBE API KEY", {
    leaveOnEnd: true,
    leaveOnStop: true
});
// To easily access the player
client.player = player;

client.on("ready", () => {
    console.log("I'm ready !");
});

client.login(settings.token);
```

### Play

To play a song, use the `client.manager.play()` function.  

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

To pause the current song, use the `client.manager.pause()` function.  

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

To resume the current song, use the `client.manager.resume()` function.  

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

To stop the music, use the `client.manager.stop()` function.  

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

To update the volume, use the `client.manager.setVolume()` function.  

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
        song.queue.on('songChanged', (oldSong, newSong) => {
            message.channel.send(`Now playing ${newSong}...`);
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