# How to add custom audio filters?

Audio filters in **Discord Player** are **[FFmpeg audio filters](http://ffmpeg.org/ffmpeg-all.html#Audio-Filters)**. You can add your own audio filter like this:

```js
const { AudioFilters } = require("discord-player");

AudioFilters.define("3D", "apulsator=hz=0.128");

// later, it can be used like this
queue.setFilters({ "3D": true });
```