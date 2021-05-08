# Pause and Resume is not working properly
This is a bug in **[discord.js#5300](https://github.com/discordjs/discord.js/issues/5300)**.

# Fix
You have to update your command something like this:

```diff
- client.player.resume(message);

+ client.player.resume(message);
+ client.player.pause(message);
+ client.player.resume(message);
```