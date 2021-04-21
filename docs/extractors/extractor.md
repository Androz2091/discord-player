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
        thumbnail: data.thumbnail,
        // engine, can be Readable streams or link to raw stream that gets played
        engine: data.streamURL,
        // number of views
        views: 0,
        // author of this stream
        author: data.artist.name,
        // description
        description: "",
        // link of this stream
        url: data.url
    }
    ```
 - `important: boolean`
   
   You can mark your Extractor as `important` by adding `important: true` to your extractor object. Doing this will disable rest of the extractors that comes after your extractor and use your extractor to get data. By default, it is set to `false`.

 - `version: string`

   This should be the version of your extractor. It is not really important and is set to `0.0.0` by default.

# Examples
### You can check out **[@discord-player/extractor](https://github.com/Snowflake107/discord-player-extractors)**