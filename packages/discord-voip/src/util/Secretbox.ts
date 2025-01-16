import { Buffer } from 'node:buffer';

interface Methods {
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext: Buffer,
    additionalData: Buffer,
    nonce: Buffer,
    key: ArrayBufferLike,
  ): Buffer;
}

const libs = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'sodium-native': (sodium: any): Methods => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt: (
      plaintext: Buffer,
      additionalData: Buffer,
      nonce: Buffer,
      key: ArrayBufferLike,
    ) => {
      const cipherText = Buffer.alloc(
        plaintext.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES,
      );
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        cipherText,
        plaintext,
        additionalData,
        null,
        nonce,
        key,
      );
      return cipherText;
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sodium: (sodium: any): Methods => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt: (
      plaintext: Buffer,
      additionalData: Buffer,
      nonce: Buffer,
      key: ArrayBufferLike,
    ) => {
      return sodium.api.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        additionalData,
        null,
        nonce,
        key,
      );
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'libsodium-wrappers': (sodium: any): Methods => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt: (
      plaintext: Buffer,
      additionalData: Buffer,
      nonce: Buffer,
      key: ArrayBufferLike,
    ) => {
      return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        additionalData,
        null,
        nonce,
        key,
      );
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  '@stablelib/xchacha20poly1305': (stablelib: any): Methods => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt(
      cipherText,
      additionalData,
      nonce,
      key,
    ) {
      const crypto = new stablelib.XChaCha20Poly1305(key);
      return crypto.seal(nonce, cipherText, additionalData);
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  '@noble/ciphers/chacha': (noble: any): Methods => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      additionalData,
      nonce,
      key,
    ) {
      const chacha = noble.xchacha20poly1305(key, nonce, additionalData);
      return chacha.encrypt(plaintext);
    },
  }),
} as const;

// @ts-ignore
libs['sodium-javascript'] = libs['sodium-native'];

const validLibs = Object.keys(libs);

const fallbackError = () => {
  throw new Error(
    `Cannot play audio as no valid encryption package is installed.
- Install one of the following packages: ${validLibs.join(', ')}
- Use the generateDependencyReport() function for more information.\n`,
  );
};

const methods: Methods = {
  crypto_aead_xchacha20poly1305_ietf_encrypt: fallbackError,
};

void (async () => {
  for (const libName of Object.keys(libs) as (keyof typeof libs)[]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const lib = await import(libName);
      if (libName === 'libsodium-wrappers' && lib.ready) await lib.ready;
      Object.assign(methods, libs[libName](lib));
      break;
    } catch {
      //
    }
  }
})();

export { methods };
