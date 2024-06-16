import { unsafe } from '../common/types';

export interface ISodium {
    open(buffer: Buffer, nonce: Buffer, key: Uint8Array): Buffer;
    close(buffer: Buffer, nonce: Buffer, key: Uint8Array): Buffer;
    random(length: number, target?: Buffer): Buffer;
}

const libs: Record<string, (lib: unsafe) => ISodium> = {
    'sodium-native': (lib) => ({
        open(buffer, nonce, key) {
            const result = Buffer.allocUnsafe(buffer.length - lib.crypto_secretbox_MACBYTES);
            lib.crypto_secretbox_open_easy(result, buffer, nonce, key);
            return result;
        },
        close(buffer, nonce, key) {
            const result = Buffer.allocUnsafe(buffer.length + lib.crypto_secretbox_MACBYTES);
            lib.crypto_secretbox_easy(result, buffer, nonce, key);
            return result;
        },
        random(length, target) {
            const buffer = target ?? Buffer.allocUnsafe(length);
            lib.randombytes_buf(buffer);
            return buffer;
        }
    }),
    sodium: (lib) => ({
        open: lib.api.crypto_secretbox_open_easy,
        close: lib.api.crypto_secretbox_easy,
        random: (length, target) => {
            const buffer = target ?? Buffer.allocUnsafe(length);
            lib.api.randombytes_buf(buffer);
            return buffer;
        }
    }),
    'libsodium-wrappers': (lib) => ({
        open: lib.crypto_secretbox_open_easy,
        close: lib.crypto_secretbox_easy,
        random: lib.randombytes_buf
    }),
    tweetnacl: (lib) => ({
        open: lib.secretbox.open,
        close: lib.secretbox,
        random: lib.randombytes_buf
    })
};

libs['sodium-javascript'] = libs['sodium-native'];

const err = () => {
    const supported = Object.keys(libs).join(', ');

    throw new Error(`No supported libsodium found. Make sure you have installed one of ${supported} in your project.`);
};

const libsodium: ISodium = {
    open: err,
    close: err,
    random: err
};

(async () => {
    const libsEntries = Object.entries(libs);

    for (const [name, lib] of libsEntries) {
        try {
            const _sod = await import(name);
            const sod = 'default' in _sod ? _sod.default : _sod;

            if (name === 'libsodium-wrappers' && 'ready' in sod) await sod.ready;

            Object.assign(libsodium, lib(sod));
            break;
        } catch {
            //
        }
    }
})();

export { libsodium };
