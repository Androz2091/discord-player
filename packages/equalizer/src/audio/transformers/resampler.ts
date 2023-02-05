export interface AFResampleConfig {
    sourceSampleRate: number;
    targetSampleRate: number;
    bits: number;
    readInt: (c: Buffer, idx: number) => number;
    writeInt: (c: Buffer, int: number, idx: number) => unknown;
}

export function resamplePCM(chunk: Buffer, config: AFResampleConfig) {
    const { bits, readInt, sourceSampleRate, targetSampleRate, writeInt } = config;

    if (sourceSampleRate === targetSampleRate) return chunk;

    const extremum = Math.pow(2, bits - 1),
        bytes = bits / 8;
    const chunkLength = chunk.length / 2;

    const resampledData = Buffer.alloc(Math.floor((chunkLength * targetSampleRate) / sourceSampleRate));
    const resLen = resampledData.length;

    let i = 0,
        j = 0;

    while (j < resLen) {
        let sum = 0,
            sample = 0;
        const resamplePoint = (sourceSampleRate * j) / targetSampleRate;
        for (let k = -bits; k <= bits; k++) {
            if (i + k >= 0 && i + k < chunkLength) {
                sample = readInt(chunk, 2 * (i + k));
                const x = k - resamplePoint + i;
                sum += sample * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
            }
        }

        if (isNaN(sum)) {
            writeInt(resampledData, sample, j);
        } else {
            writeInt(resampledData, Math.min(extremum - 1, Math.max(-extremum, sum)), j);
        }

        j += bytes;
        i = Math.floor(resamplePoint);
    }

    return resampledData;
}
