# Discord Player

Discord Player v8

Embedded playback requires **Node.js 22.18.0+ (ESM)** and separately installed **FFmpeg 9 shared libraries**. npm installs Remedia's native addon, but does not install FFmpeg; having `ffmpeg.exe` or an `ffmpeg` command alone is insufficient. Remedia includes its Opus encoder statically.

For platform-specific packages, library verification, and loader troubleshooting, see [Installing FFmpeg 9 libraries](https://discord-player.js.org/docs/installation/ffmpeg). A bot connecting exclusively to remote Remedia servers does **not** need FFmpeg locally; the server machine does.
