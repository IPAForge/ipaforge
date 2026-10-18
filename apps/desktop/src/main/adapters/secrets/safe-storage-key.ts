// The encrypted secret store's file key, kept in a file that Electron's safeStorage encrypts with the OS keychain
// (macOS Keychain, Windows DPAPI, the Linux secret service). The port is structural, so this is tested without
// Electron.
import { readFile } from 'node:fs/promises'

import type { KeyProvider } from '@desktop/main/adapters/secrets/mac-keychain-key.ts'
import { writePrivateFile } from '@desktop/main/adapters/secrets/private-file.ts'
import { fromHex, toHex } from '@ipaforge/kernel'

const KEY_BYTES = 32
/** Linux without a keyring: safeStorage "encrypts" with a hard-coded password, which protects nothing. */
const INSECURE_BACKEND = 'basic_text'

/** The part of Electron's `safeStorage` this uses. */
export type SafeStorageLike = {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Uint8Array
  decryptString(encrypted: Uint8Array): string
  /** Linux only. */
  getSelectedStorageBackend?(): string
}

/** Whether safeStorage really encrypts with an OS-held key on this machine. */
export const isSafeStorageUsable = (
  safeStorage: SafeStorageLike,
  platform: NodeJS.Platform
): boolean =>
  safeStorage.isEncryptionAvailable() &&
  !(
    platform === 'linux' &&
    safeStorage.getSelectedStorageBackend?.() === INSECURE_BACKEND
  )

const readKeyFile = async (path: string): Promise<Uint8Array | undefined> => {
  try {
    return new Uint8Array(await readFile(path))
  } catch {
    return undefined
  }
}

/** Reads the key from `path`, or creates it there on first use. */
export const safeStorageKey =
  (safeStorage: SafeStorageLike, path: string): KeyProvider =>
  async () => {
    const sealed = await readKeyFile(path)
    if (sealed) return fromHex(safeStorage.decryptString(sealed))
    const key = globalThis.crypto.getRandomValues(new Uint8Array(KEY_BYTES))
    await writePrivateFile(path, safeStorage.encryptString(toHex(key)))
    return key
  }
