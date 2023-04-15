### Accessing player instance

We have seen a lot of examples where we could assign `Player` to `client.player` for easy access of the `Player` instance. But polluting client like this could be a bad idea:

```js
client.player = player;
```

This would also remove intellisense as `client` does not have a property called `player`. To solve this issue, discord-player provides singleton constructor support. You just need to update your code to the following:

```diff
- const player = new Player(client);
+ const player = Player.singleton(client);
```

The code above will not create duplicate instances of `Player`. Each time you call `Player.singleton()`, you will receive the same instance and full intellisense.

> `Player.singleton()` creates a single instance of player which is shared in the future. You can simply do `Player.singleton()` to access player instance whenever you want without polluting client.

Once you initialize Player, you can access that instance of player from anywhere as shown below:

```js
const { useMasterPlayer } = require("discord-player");
const player = useMasterPlayer();
```