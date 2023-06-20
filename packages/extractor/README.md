# Extractors

Extractors for `discord-player`.

# Example

```js
const { YouTubeExtractor } = require('@discord-player/extractor');
const player = useMainPlayer();

// enables youtube extractor
player.extractors.register(YouTubeExtractor);
```

# Available Extractors

-   Attachment (Remote, Local)
-   Reverbnation
-   SoundCloud
-   Vimeo
-   YouTube
-   Spotify
-   Apple Music

# Lyrics

```js
const { lyricsExtractor } = require('@discord-player/extractor');
const lyricsClient = lyricsExtractor('api_key_or_leave_it_blank');

lyricsClient
    .search('alan walker faded')
    .then((x) => console.log(x))
    .catch(console.error);
```

## Response

```js
{
  title: 'Faded',
  id: 2396871,
  thumbnail: 'https://images.genius.com/10db94c5c11e1bb1ac9cc917a6c59250.300x300x1.jpg',
  image: 'https://images.genius.com/10db94c5c11e1bb1ac9cc917a6c59250.1000x1000x1.jpg',
  url: 'https://genius.com/Alan-walker-faded-lyrics',
  artist: {
    name: 'Alan Walker',
    id: 456537,
    url: 'https://genius.com/artists/Alan-walker',
    image: 'https://images.genius.com/5dc7f5c57981ba34e464414f7fc08ebf.1000x333x1.jpg'
  },
  lyrics: '[Verse 1]\n' +
    'You were the shadow to my light\n' +
    'Did you feel us?\n' +
    'Another star, you fade away\n' +
    'Afraid our aim is out of sight\n' +
    'Wanna see us alight\n' +
    '\n' +
    '[Pre-Chorus 1]\n' +
    'Where are you now?\n' +
    'Where are you now?\n' +
    'Where are you now?\n' +
    'Was it all in my fantasy?\n' +
    'Where are you now?\n' +
    'Were you only imaginary?\n' +
    '\n' +
    '[Chorus]\n' +
    'Where are you now?\n' +
    'Atlantis, under the sea, under the sea\n' +
    'Where are you now? Another dream\n' +
    "The monster's running wild inside of me\n" +
    "I'm faded, I'm faded\n" +
    "So lost, I'm faded, I'm faded\n" +
    "So lost, I'm faded\n" +
    '\n' +
    '[Verse 2]\n' +
    'These shallow waters never met what I needed\n' +
    "I'm letting go, a deeper dive\n" +
    'Eternal silence of the sea\n' +
    "I'm breathing, alive\n" +
    '\n' +
    '[Pre-Chorus 2]\n' +
    'Where are you now?\n' +
    'Where are you now?\n' +
    'Under the bright but faded lights\n' +
    'You set my heart on fire\n' +
    'Where are you now?\n' +
    'Where are you now?\n' +
    '\n' +
    '[Chorus]\n' +
    'Where are you now?\n' +
    'Atlantis, under the sea, under the sea\n' +
    'Where are you now? Another dream\n' +
    "The monster's running wild inside of me\n" +
    "I'm faded, I'm faded\n" +
    "So lost, I'm faded, I'm faded\n" +
    "So lost, I'm faded"
}
```
