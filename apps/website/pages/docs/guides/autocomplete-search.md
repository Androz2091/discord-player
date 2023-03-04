# Search Autocomplete

You can return suggestions to autocomplete interaction using discord-player. Just apply something similar:

```js
import { useMasterPlayer } from 'discord-player';

async function autocompleteRun(interaction) {
    const player = useMasterPlayer();
    const query = interaction.options.getString('query', true);
    const results = await player.search(query);

    return interaction.respond(
        results.tracks.slice(0, 10).map((t) => ({
            name: t.title,
            value: t.url
        }))
    );
}
```