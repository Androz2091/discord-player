# Discord Player Extractor API
The Extractor API allows you to build your own stream extractor for **Discord Player**.

# Example Extractor
Your extractor should have 2 methods (required):
 - `validate(query): boolean`
   
   This method is called by Discord Player while validating the query provided via `Player.play()`. (Note that only `string` queries are passed to your extractor)

 - `getInfo(query): object`
   
   This method is used by Discord Player to create `Track` object. You can return your data here that gets passed to `Track`.
   Your info must be similar to this:

    ```js
    {
        // the title
        title: "Extracted by custom extractor",
        // the duration in ms
        duration: 20000,
        // the thumbnail
        thumbnail: "some thumbnail link",
        // engine, can be Readable streams or link to raw stream that gets played
        engine: "someStreamLink",
        // number of views
        views: 0,
        // author of this stream
        author: "Some Artist",
        // description
        description: "",
        // link of this stream
        url: "Some Link"
    }
    ```

 - `version: string`

   This should be the version of your extractor. It is not really important and is set to `0.0.0` by default.

# Loading Extractors
Discord Player Extractors can be loaded using `Player.use(ExtractorName, Extractor)` method.

## Register Extractor

```js
const myExtractor = {
  version: "1.0.0",
  important: false,
  validate: (query) => true,
  getInfo: async (query) => {
    return {
        title: "Extracted by custom extractor",
        duration: 20000,
        thumbnail: "some thumbnail link",
        engine: "someStreamLink",
        views: 0,
        author: "Some Artist",
        description: "",
        url: "Some Link"
    };
  }
};

player.use("GiveItSomeName", myExtractor);
```

## Remove Extractor

```js
player.unuse("GiveItSomeName");
```

# Readymade Extractors
## **[@discord-player/extractor](https://github.com/Snowflake107/discord-player-extractors)**
This extractor enables optional sources such as `Discord Attachments`, `Vimeo`, `Facebook` and `Reverbnation`. It also enables the `Lyrics` feature!

## **[@discord-player/downloader](https://github.com/DevSnowflake/discord-player-downloader)**
This extractor is based on **[YouTube DL](https://youtube-dl.org)**. This extractor enables `700+ websites` support. However, this extractor can get buggy and is not updated frequently. So, it is suggested to make your own extractor if you want to use it!

```js
const downloader = require("@discord-player/downloader").Downloader;

player.use("YOUTUBE_DL", downloader);
```

> Discord Player auto-detects and uses `@discord-player/extractor` if it is installed!