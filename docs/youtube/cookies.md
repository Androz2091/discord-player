# Using Cookies to avoid 429

```js
const { Player } = require("discord-player");

const player = new Player(client, {
    ytdlDownloadOptions: {
        requestOptions: {
            headers: {
                cookie: "YOUR_YOUTUBE_COOKIE"
            }
        }
    }
});
```