# `@discord-player/equalizer`

This library implements Lavaplayer's 15 Band PCM Equalizer & biquad utilities.

## Installation

```sh
$ npm install --save @discord-player/equalizer
```

## Example

#### Equalizer

```js
import { EqualizerStream } from '@discord-player/equalizer';

// initialize 15 band equalizer stream
const equalizer = new EqualizerStream();

// set equalizer bands, in this case add some bass
equalizer.setEQ([
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.25 },
    { band: 2, gain: 0.25 }
]);

// input stream
const input = getPCMAudioSomehow();

// pipe input stream to equalizer
const output = input.pipe(equalizer);

// now do something with the output stream
```

#### Biquad

```js
import { BiquadFilter, Coefficients, FilterType, Q_BUTTERWORTH, Frequency } from '@discord-player/equalizer';

const f0 = new Frequency(10).hz();
const fs = new Frequency(1).khz();

const coeffs = Coefficients.from(FilterType.LowPass, fs, f0, Q_BUTTERWORTH);
const biquad = new BiquadFilter(coeffs);

const input = [0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

const out1 = input.map((i) => biquad.run(i));
const out2 = input.map((i) => biquad.runTransposed(i));
```