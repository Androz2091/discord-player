# How to play live videos

You cannot play live videos by default. If you need to play the live video, just add this option:

```js
const player = new Player(client, {
    enableLive: true // enables livestream
});
```

However, you cannot use audio filters with livestreams using this library!