## Supported sources

By default, discord-player **does not support anything** (including search operation and streaming). Luckily, discord-player supports the following sources with the help of [@discord-player/extractor](https://npm.im/@discord-player/extractor) which comes pre-installed with discord-player:

-   Local file (You must set the search engine to `QueryType.FILE` in order to play local files, backed by `attachment extractor`)
-   Raw attachments (backed by `attachment extractor`)
-   Spotify (backed by `ysa extractor`)
-   Apple Music (backed by `ysa extractor`)
-   YouTube (backed by `ysa extractor`)
-   Vimeo (backed by `vimeo extractor`)
-   Reverbnation (backed by `reverbnation extractor`)
-   SoundCloud (backed by `soundcloud extractor`)

If you dont want to stream from certain extractors, you can block them by passing `blockStreamFrom: [id, id, ...]` to player instantiation options.
Disabling youtube streaming completely would be as easy as:

```js
import { Player } from 'discord-player';
import { YouTubeExtractor } from '@discord-player/extractor';

const player = new Player(client, {
    blockStreamFrom: [
        // now your bot will no longer be able to use
        // youtube extractor to play audio even if the track was
        // extracted from youtube
        YouTubeExtractor.identifier
    ],
    blockExtractors: [
        // this will block the listed extractors from being
        // able to query metadata (aka search results parsing)
        // This example disables youtube search, spotify bridge
        // and apple music bridge
        YouTubeExtractor.identifier
    ]
});
```

Likewise, You can also force a specific extractor to resolve your search query. This is useful in some cases where you don't want to use other sources.

You can do so by using `ext:<EXTRACTOR_IDENTIFIER>` in `searchEngine` value. Example:

```js
import { SoundCloudExtractor } from '@discord-player/extractor';

const result = await player.search(query, {
    // always use soundcloud extractor
    searchEngine: SoundCloudExtractor.identifier
});
```

### Adding more sources

Discord Player provides an **Extractor API** that enables you to use your custom stream extractor with it. Some packages have been made by the community to add new features using this API.