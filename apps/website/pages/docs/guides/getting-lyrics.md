# Getting Lyrics

How cool would it be if you could get lyrics of the desired song? Well, Discord Player's Lyrics extractor can help you with that. This feature is powered by [node-genius-lyrics](https://npm.im/genius-lyrics) library.

## Example

```js
import { lyricsExtractor } from '@discord-player/extractor';

const lyricsFinder = lyricsExtractor(/* 'optional genius API key' */);

const lyrics = await lyricsFinder.search('alan walker faded').catch(() => null);
if (!lyrics) return interaction.followUp({ content: 'No lyrics found', ephemeral: true });

const trimmedLyrics = lyrics.lyrics.substring(0, 1997);

const embed = new EmbedBuilder()
    .setTitle(lyrics.title)
    .setURL(lyrics.url)
    .setThumbnail(lyrics.thumbnail)
    .setAuthor({
        name: lyrics.artist.name,
        iconURL: lyrics.artist.image,
        url: lyrics.artist.url
    })
    .setDescription(trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics)
    .setColor('Yellow');

return interaction.followUp({ embeds: [embed] });
```

> **Note:**
> It may not find lyrics when using `track.title` as the search query as they contain other infos than just song title.