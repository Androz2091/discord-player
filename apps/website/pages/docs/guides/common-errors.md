# Cannot find opusscript or @discordjs/opus or node-opus

Install opus encoder.

```sh
$ yarn add @discordjs/opus
# or
$ yarn add opusscript
# or
$ yarn add node-opus
```

# FFmpeg/Avconv not found

Make sure you have `FFmpeg` or `Avconv` available on your system.

### Install FFmpeg or Avconv

-   Download from official FFmpeg website: **[www.ffmpeg.org/download.html](https://www.ffmpeg.org/download.html)**
-   Node Module (ffmpeg-static): **[npmjs.com/package/ffmpeg-static](https://npmjs.com/package/ffmpeg-static)**
-   Avconv: If you want to use Avconv instead of FFmpeg, install it on your system or place Avconv executable at the root of your project.

# "something" is not working

-   Try attaching `debug` listener to `player.events` to see if something strange is going on.

-   If you are getting weird errors like something is not a constructor or version.split is not a function or something similar, please try the following:

    Remove `node_modules`, `package-lock.json` or any lockfiles you have, run `npm cache clean --force` or similar command equivalent to your package manager and then run `yarn add` (or the install command of your package manager)

-   If you are unable to solve the problem, please join our official support server 👉 [https://androz2091.fr/discord](https://androz2091.fr/discord)
