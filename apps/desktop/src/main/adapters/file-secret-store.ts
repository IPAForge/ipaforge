// A SecretStore backed by one JSON file readable only by the user (0600). Development tooling only: Phase 9 puts
// app secrets behind the OS keychain (Electron safeStorage). Keys are base64-encoded values.
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SecretStore } from "@loadstar/kernel";
import { fromBase64, toBase64 } from "@loadstar/kernel";

export const createFileSecretStore = (path: string): SecretStore => {
  let cache: Record<string, string> | undefined;
  const load = async (): Promise<Record<string, string>> => {
    if (cache) return cache;
    try {
      cache = JSON.parse(await readFile(path, "utf8")) as Record<string, string>;
    } catch {
      cache = {};
    }
    return cache;
  };
  const save = async (values: Record<string, string>) => {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(values), { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  };
  return {
    get: async (key) => {
      const value = (await load())[key];
      return value === undefined ? undefined : fromBase64(value);
    },
    set: async (key, value) => {
      const values = await load();
      values[key] = toBase64(value);
      await save(values);
    },
    delete: async (key) => {
      const values = await load();
      if (!(key in values)) return;
      delete values[key];
      await save(values);
    },
  };
};

/** Routes keys by prefix: matching keys go to `persistent`, everything else to `volatile`. */
export const createRoutedSecretStore = (
  prefixes: readonly string[],
  persistent: SecretStore,
  volatile: SecretStore,
): SecretStore => {
  const pick = (key: string) => (prefixes.some((prefix) => key.startsWith(prefix)) ? persistent : volatile);
  return {
    get: (key) => pick(key).get(key),
    set: (key, value) => pick(key).set(key, value),
    delete: (key) => pick(key).delete(key),
  };
};
