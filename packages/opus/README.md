# `@discord-player/opus`

Streamable Opus encoder and decoder for Discord Player.

## Installation

```sh
$ yarn add @discord-player/opus
```

Additionally, install one of the following opus libraries:

-   `mediaplex`
-   `@discordjs/opus`
-   `opusscript`
-   `@evan/opus`
-   `node-opus`

If one does not work, feel free to switch to another.

## Adding custom opus library

```js
import { OPUS_MOD_REGISTRY } from '@discord-player/opus';

OPUS_MOD_REGISTRY.unshift(['my-opus-package-name', (mod) => ({ Encoder: mod.OpusEncoder })]);
```

Make sure to use this code before using any of the opus classes.

## Example

```js
import { OpusEncoder, OpusDecoder } from '@discord-player/opus';

// encode
const opusStream = getPcmStreamSomehow().pipe(new OpusEncoder({ rate: 48000, channels: 2, frameSize: 960 }));

// decode
const pcmStream = getOpusStreamSomehow().pipe(new OpusDecoder({ rate: 48000, channels: 2, frameSize: 960 }));
```
