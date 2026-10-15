// Development tooling: a SecretStore kept in one AES-256-GCM encrypted file, with the key in the OS keychain
// (macOS: the user's login keychain via `security`). The app itself uses Electron safeStorage (Phase 9).
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { SecretStore } from "@loadstar/kernel";
import { fromBase64, fromHex, toBase64, toHex, utf8Decode, utf8Encode } from "@loadstar/kernel";

const run = promisify(execFile);
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** Supplies the file key (32 bytes), creating it on first use. */
export type KeyProvider = () => Promise<Uint8Array>;

/**
 * macOS login keychain. The key is created once (generic password `service`/`account`) and read back with
 * `security find-generic-password -w`; macOS may ask the user to allow access.
 */
export const macKeychainKey =
  (service: string, account = "file-key"): KeyProvider =>
  async () => {
    try {
      const { stdout } = await run("security", ["find-generic-password", "-s", service, "-a", account, "-w"]);
      return fromHex(stdout.trim());
    } catch {
      const key = globalThis.crypto.getRandomValues(new Uint8Array(KEY_BYTES));
      await run("security", ["add-generic-password", "-s", service, "-a", account, "-w", toHex(key), "-U"]);
      return key;
    }
  };

const buffer = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => bytes as Uint8Array<ArrayBuffer>;

export const createEncryptedFileSecretStore = (path: string, keyProvider: KeyProvider): SecretStore => {
  let key: Promise<CryptoKey> | undefined;
  let cache: Record<string, string> | undefined;

  const cryptoKey = (): Promise<CryptoKey> => {
    key ??= keyProvider().then((raw) =>
      globalThis.crypto.subtle.importKey("raw", buffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]),
    );
    return key;
  };

  const load = async (): Promise<Record<string, string>> => {
    if (cache) return cache;
    let sealed: Uint8Array;
    try {
      sealed = new Uint8Array(await readFile(path));
    } catch {
      cache = {};
      return cache;
    }
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buffer(sealed.subarray(0, IV_BYTES)) },
      await cryptoKey(),
      buffer(sealed.subarray(IV_BYTES)),
    );
    cache = JSON.parse(utf8Decode(new Uint8Array(plain))) as Record<string, string>;
    return cache;
  };

  const save = async (values: Record<string, string>) => {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = new Uint8Array(
      await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await cryptoKey(),
        buffer(utf8Encode(JSON.stringify(values))),
      ),
    );
    const out = new Uint8Array(IV_BYTES + sealed.byteLength);
    out.set(iv, 0);
    out.set(sealed, IV_BYTES);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(`${path}.tmp`, out, { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  };

  return {
    get: async (name) => {
      const value = (await load())[name];
      return value === undefined ? undefined : fromBase64(value);
    },
    set: async (name, value) => {
      const values = await load();
      values[name] = toBase64(value);
      await save(values);
    },
    delete: async (name) => {
      const values = await load();
      if (!(name in values)) return;
      delete values[name];
      await save(values);
    },
  };
};
