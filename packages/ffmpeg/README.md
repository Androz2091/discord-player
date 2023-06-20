# `@discord-player/ffmpeg`

FFmpeg stream abstraction for Discord Player.

## Installation

```sh
$ yarn add --save @discord-player/ffmpeg
```

## Supported FFmpeg Locations

-   `process.env.FFMPEG_PATH`
-   command `ffmpeg`
-   command `avconv`
-   command `./ffmpeg` (`./ffmpeg.exe` on windows)
-   command `./avconv` (`./avconv.exe` on windows)
-   npm package [@ffmpeg-installer/ffmpeg](https://npm.im/@ffmpeg-installer/ffmpeg)
-   npm package [ffmpeg-static](https://npm.im/ffmpeg-static)
-   npm package [@node-ffmpeg/node-ffmpeg-installer](@node-ffmpeg/node-ffmpeg-installer)
-   npm package [ffmpeg-binaries](https://npm.im/ffmpeg-binaries)

## Example

<!-- prettier-ignore -->
```js
import { FFmpeg } from '@discord-player/ffmpeg';

const transcoder = new FFmpeg({
    args: [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-af', 'bass=g=15,acompressor'
    ]
});

const stream = getAudioStreamSomehow();
const transcoded = stream.pipe(transcoder);
```
