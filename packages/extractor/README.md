# Extractors

Extractors for `discord-player`.

# Example

```js
const { SoundCloudExtractor } = require('@discord-player/extractor');
const player = useMainPlayer();

// enables soundcloud extractor
player.extractors.register(SoundCloudExtractor);
```

# Available Extractors

- Attachment (Remote, Local)
- Reverbnation
- SoundCloud
- Vimeo
- Spotify
- Apple Music
