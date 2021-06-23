import { Duplex, Readable, PassThrough } from "stream";

class StreamUtils {
    /**
     * Stream utils
     */
    constructor() {
        throw new Error("Cannot instantiate static class");
    }

    /**
     * Can be used to re-create used streams
     * @param {Readable|Duplex} stream The used stream
     * @returns {Readable}
     */
    static clone(stream: Readable | Duplex): Readable {
        const passed = stream.pipe(new PassThrough());
        return passed;
    }

    /**
     * Converts stream to buffer
     * @param {Readable|Duplex} stream The stream
     * @returns {Promise<Buffer>}
     */
    static toBuffer(stream: Readable | Duplex): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);
        });
    }
}

export { StreamUtils };
