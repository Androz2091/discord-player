# Migrating to Discord Player v5

We have introduced some breaking changes in Discord Player v5. Which means, your old code will no longer work with v5.
The new update brings new features as well as better management of different things. This also uses the new **[@discordjs/voice](https://github.com/discordjs/voice)** library!

## Basic Example

```diff
- player.play(message, query);
+ const queue = player.createQueue(message.guild);
+ const song = await player.search(query, {
+   requestedBy: message.author
});
+ 
+ try {
+   await queue.connect(message.member.voice.channel);
+ } catch {
+   message.reply("Could not join your voice channel");
+ }
+
+ queue.addTrack(song.tracks[0]);
+ queue.play();
```

> Everything related to music player is moved to `Queue`.

## How do I reply to the event like v4?

Since we got rid of `message` parameter in every method of the Discord Player, you no longer have access to the `message` object in events.
Instead, we have added `<Queue>.metadata` prop as an alternative. This `metadata` can be anything, declared while creating queue:

```js
const queue = player.createQueue(message.guild, {
    metadata: message
});
```

The metadata `message` will always be available in every event emitted for that specific `Queue`. You can access it via `queue.metadata`:

```js
player.on("trackStart", (queue, track) => {
    const channel = queue.metadata.channel; // queue.metadata is your "message" object
    channel.send(`🎶 | Started playing **${track.title}**`);
});
```

## How do I stop the player

You have to use `<Queue>.destroy()` to destroy the queue. It will also stop the player.

```js
const queue = player.getQueue(message.guild.id);
if (queue) queue.destroy();
```

## Updating filters

Discord Player v5.x has new option `bufferingTimeout` in queue init options which allows you to set stream buffering timeout before playing.
This might be useful if you want to have smooth filters update. By default, it is set to 3 seconds.
