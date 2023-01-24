# Using Cookies to avoid 429

```js
const { Player } = require("discord-player");

const player = new Player(client, {
    ytdlOptions: {
        requestOptions: {
            headers: {
                cookie: "YOUR_YOUTUBE_COOKIE"
            }
        }
    }
});
```

> Keep in mind that using `cookies` after getting `429` **does not fix the problem**.
> You should use `cookies` before getting `429` which helps to **_reduce_** `Error: Status Code 429`