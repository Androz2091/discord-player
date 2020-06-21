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

## Player

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

client.login(settings.token);
```

You can pass a third parameter when instantiating the class Player: the **options** object:  
**options.leaveOnEnd**: whether the bot should leave the voice channel when there is no more track in the queue.  
**options.leaveOnStop**: whether the bot should leave the voice channel when the `stop()` function is used.  
**options.leaveOnEmpty**: whether the bot should leave the voice channel if there is no more member in it.

### Features Overview

You need to **init the guild queue using the play() function**, then you are able to manage the queue using the following functions:

```js
// Play a track in the voice channel and init the guild queue
client.player.play(voiceChannel, trackName);

// Add a track to the queue
client.player.addToQueue(guildID, trackName);
// Clear the queue
client.player.clearQueue(guildID);
// Get the queue
client.player.getQueue(guildID);
// Skip the current track
client.player.skip(guildID);
// Remove a track from the queue using the index number
client.player.remove(guildID, track);

// Filters!
client.player.updateFilters(guildID, {
    bassboost: true,
    vaporwave: true
})

// Pause
client.player.pause(guildID);
// Resume
client.player.resume(guildID);
// Stop
client.player.stop(guildID);

// Check if music is playing in a guild
client.player.isPlaying(guildID);
// Get the currently playing trac
client.player.nowPlaying(guildID);


// Current track will be repeated indefinitely
client.player.setRepeatMode(guildID, true);
// Current track will no longer be repeated indefinitely
client.player.setRepeatMode(guildID, false);
```

### Event messages

```js
// Play the music
await client.player.play(message.member.voice.channel, "Despacito")

// Then add some messages that will be sent when the events will be triggered
client.player.getQueue(guildID)
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

## Examples

### Play

To play a track, use the `client.player.play()` function.  

**Usage:**

```js
client.player.play(voiceChannel, trackName, requestedBy);
```

**Example**:

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // !play Despacito
    // will play "Despacito" in the member voice channel

    if(command === 'play'){
        let track = await client.player.play(message.member.voice.channel, args[0], message.member.user.tag);
        message.channel.send(`Currently playing ${track.name}! - Requested by ${track.requestedBy}`);
    }

```

### Pause

To pause the current track, use the `client.player.pause()` function.  

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
        let track = await client.player.pause(message.guild.id);
        message.channel.send(`${track.name} paused!`);
    }

});
```

### Resume

To resume the current track, use the `client.player.resume()` function.  

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
        let track = await client.player.resume(message.guild.id);
        message.channel.send(`${track.name} resumed!`);
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

To add a track to the queue, use the `client.player.addToQueue()` function.

**Usage:**

```js
client.player.addToQueue(guildID, trackName);
```

**Example:**

In this example, you will see how to add a track to the queue if one is already playing.

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'play'){
        let aTrackIsAlreadyPlaying = client.player.isPlaying(message.guild.id);
        // If there's already a track playing
        if(aTrackIsAlreadyPlaying){
            // Add the track to the queue
            let track = await client.player.addToQueue(message.guild.id, args[0]);
            message.channel.send(`${track.name} added to queue!`);
        } else {
            // Else, play the track
            let track = await client.player.play(message.member.voice.channel, args[0]);
            message.channel.send(`Currently playing ${track.name}!`);
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
        message.channel.send('Server queue:\n'+(queue.tracks.map((track, i) => {
            return `${i === 0 ? 'Current' : `#${i+1}`} - ${track.name} | ${track.author}`
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

To skip the current track, use the `client.player.skip()` function.  

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
        let track = await client.player.skip(message.guild.id);
        message.channel.send(`${track.name} skipped!`);
    }

});
```

### Now Playing

To get the currently playing track, use the `client.player.nowPlaying()` function.  

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
        let track = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`Currently playing ${track.name}...`);
    }

});
```

### Repeat

To repeat the current track, use the `client.player.setRepeatMode()` function.  

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
        // Get the current track
        let track = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`${track.name} will be repeated indefinitely!`);
    }

    if(command === 'disable-repeat'){
        // Disable repeat mode
        client.player.setRepeatMode(message.guild.id, false);
        // Get the current track
        let track = await client.player.nowPlaying(message.guild.id);
        message.channel.send(`${track.name}  will no longer be repeated indefinitely!`);
    }

});
```

### Remove

To remove a track from the queue, use the `client.player.remove()` function.

**Usage:**

```js
client.player.remove(guildID, track);
```

**Example:**

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'remove'){
        // Removes a track from the queue
        client.player.remove(message.guild.id, args[0]).then(() => {
            message.channel.send('Removed track!');
        });
    }
});
```

### Filters

You can apply some cool filters to your music!

**Usage:**

```js
client.player.updateFilters(guildID, {
    bassboost: true,
    '8D': true,
    vaporwave: true,
    nightcore: true,
    phaser: true,
    tremolo: true,
    reverse: true,
    treble: true,
    normalizer: true,
    surrounding: true
    pulsator: true,
    subboost: true
});
```

**Example:**

```js
client.on('message', async (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'bassboost'){
        const bassboostEnabled = client.player.getQueue(message.guild.id);
        if(!bassboostEnabled){
            client.player.updateFilters(message.guild.id, {
                bassboost: true
            });
            message.channel.send("Bassboost effect has been enabled!");
        } else {
            client.player.updateFilters(message.guild.id, {
                bassboost: false
            });
            message.channel.send("Bassboost effect has been disabled!");
        }
    }

    // You can do the same for each filter!
});
```

## Info Messages

You can send a message when the queue ends or when the track changes:

```js
client.on('message', (message) => {

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === 'play'){
        let track = await client.player.play(message.member.voice.channel, args[0]);
        track.queue.on('end', () => {
            message.channel.send('The queue is empty, please add new tracks!');
        });
        track.queue.on('trackChanged', (oldTrack, newTrack, skipped, repeatMode) => {
            if(repeatMode){
                message.channel.send(`Playing ${newTrack} again...`);
            } else {
                message.channel.send(`Now playing ${newTrack}...`);
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
    // Track not found
    if(command === 'play'){
        client.player.play(message.member.voice.channel, args[0]).then((track) => {
            message.channel.send(`Currently playing ${track.name}!`);
        }).catch(() => {
            message.channel.send(`No track found for ${args[0]}`);
        });
    }

    // Error 2:
    // Not playing
    if(command === 'queue'){
        let playing = client.player.isPlaying(message.guild.id);
        if(!playing) return message.channel.send(':x: No tracks currently playing!');
        // you are sure it works:
        client.player.getQueue(message.guild.id);
    }

});
```

## Examples of bots made with discord-player

These bots are made by the community, they can help you build your own!

* [Discord-Music](https://github.com/hydraindia/discord-music) by [hydraindia](https://github.com/hydraindia)
* [Music-bot](https://github.com/ZerioDev/Music-bot) by [ZerioDev](https://github.com/ZerioDev)
