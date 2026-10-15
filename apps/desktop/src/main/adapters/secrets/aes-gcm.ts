// AES-256-GCM sealing for the encrypted secret file: a random 12-byte IV followed by the ciphertext and tag.
const IV_BYTES = 12;

const buffer = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => bytes as Uint8Array<ArrayBuffer>;

export const importAesKey = (raw: Uint8Array): Promise<CryptoKey> =>
  globalThis.crypto.subtle.importKey("raw", buffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]);

export const seal = async (key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> => {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer(plain)),
  );
  const sealed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  sealed.set(iv, 0);
  sealed.set(ciphertext, IV_BYTES);
  return sealed;
};

/** Rejects when the key is wrong or the data was tampered with. */
export const unseal = async (key: CryptoKey, sealed: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buffer(sealed.subarray(0, IV_BYTES)) },
      key,
      buffer(sealed.subarray(IV_BYTES)),
    ),
  );
