// Decryption of the data GrandSlam returns after sign-in (`spd`) and of app tokens (`et`).
import { ErrorCode, LoadstarError, utf8Encode } from "@loadstar/kernel";

const subtle = () => globalThis.crypto.subtle;
const buffer = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => bytes as Uint8Array<ArrayBuffer>;

export const hmacSha256 = async (key: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  const imported = await subtle().importKey("raw", buffer(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle().sign("HMAC", imported, buffer(data)));
};

export const SPD_KEY_LABEL = "extra data key:";
export const SPD_IV_LABEL = "extra data iv:";
const AES_BLOCK = 16;

/** `spd`: AES-256-CBC with key HMAC(K, "extra data key:") and IV HMAC(K, "extra data iv:")[0..16]. */
export const decryptSpd = async (sessionKey: Uint8Array, spd: Uint8Array): Promise<Uint8Array> => {
  const key = await hmacSha256(sessionKey, utf8Encode(SPD_KEY_LABEL));
  const iv = (await hmacSha256(sessionKey, utf8Encode(SPD_IV_LABEL))).subarray(0, AES_BLOCK);
  try {
    const aes = await subtle().importKey("raw", buffer(key), "AES-CBC", false, ["decrypt"]);
    return new Uint8Array(await subtle().decrypt({ name: "AES-CBC", iv: buffer(iv) }, aes, buffer(spd)));
  } catch (error) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "could not decrypt session data", cause: error });
  }
};

/** `et` layout: 3-byte header (also the AAD) | 16-byte IV | ciphertext + 16-byte GCM tag. */
export const ET_HEADER = 3;
export const ET_IV = 16;

export const decryptAppToken = async (sessionKey: Uint8Array, et: Uint8Array): Promise<Uint8Array> => {
  if (et.byteLength <= ET_HEADER + ET_IV + AES_BLOCK) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "app token too short" });
  }
  const header = et.subarray(0, ET_HEADER);
  const iv = et.subarray(ET_HEADER, ET_HEADER + ET_IV);
  try {
    const aes = await subtle().importKey("raw", buffer(sessionKey), "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(
      await subtle().decrypt(
        { name: "AES-GCM", iv: buffer(iv), additionalData: buffer(header), tagLength: 128 },
        aes,
        buffer(et.subarray(ET_HEADER + ET_IV)),
      ),
    );
  } catch (error) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "could not decrypt app token", cause: error });
  }
};
