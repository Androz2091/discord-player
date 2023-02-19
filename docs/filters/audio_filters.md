## Audio Filters

Discord Player supports various audio filters. There are 4 types of audio filter providers in discord-player.

> Did you know? **Discord Player has total of more than 64 built-in audio filter presets!**

##### FFmpeg

The most common and powerful method is FFmpeg. It supports a lot of audio filters. To set ffmpeg filter, you can do:

```js
await queue.filters.ffmpeg.toggle(['bassboost', 'nightcore']);
```

Note that there can be a delay between filters transition in this method.

##### Equalizer

This equalizer is very similar to Lavalink's 15 Band Equalizer. To use this, you can do:

```js
queue.filters.equalizer.setEQ([
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.25 },
    { band: 2, gain: 0.25 }
]);
```

> Discord Player provides some built-in equalizer presets.

There is no delay between filter transition when using equalizer.

##### Biquad

This filter provides digital biquad filterer to the player. To use this, you can do:

```js
import { BiquadFilterType } from 'discord-player';

queue.filters.biquad.setFilter(BiquadFilterType.LowPass);
// similarly, you can use other filters such as HighPass, BandPass, Notch, PeakEQ, LowShelf, HighShelf, etc.
```

There is no delay between filter transition when using biquad filters.

#### DSP Audio Filters

This is another type of audio filters provider. It currently supports `Tremolo` and `8D` filters only. To use this, you can do:

```js
queue.filters.filters.setFilters(['8D']);
```

There is no delay between filters transition using this filter.