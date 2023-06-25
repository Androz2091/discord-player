# Playing Local File

Wouldn't it be nice if you could play local files? Well, Discord Player got you covered. Discord Player natively supports local file playback with the help of `Attachment` extractor.

## Example

```js
// Relative path also works, but absolute path is recommended
// this is a path to your local file which you want to play
const filePath = 'E:/path/to/music.mp3';

await player.play(channel, filePath, {
    // in order to play local files, we need to explicitly tell discord-player to search that path in our file system
    searchEngine: QueryType.FILE // QueryType.FILE tells discord-player to play from our file system,
    // ... (other options if you need)
});
```