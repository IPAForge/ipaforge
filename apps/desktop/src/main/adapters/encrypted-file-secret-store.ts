// Development tooling: a SecretStore kept in one AES-256-GCM encrypted file, with the key in the OS keychain
// (macOS: the user's login keychain via `security`). The app itself uses Electron safeStorage (Phase 9).
import { readFile } from 'node:fs/promises'

import {
  importAesKey,
  seal,
  unseal
} from '@desktop/main/adapters/secrets/aes-gcm.ts'
import type { KeyProvider } from '@desktop/main/adapters/secrets/mac-keychain-key.ts'
import { writePrivateFile } from '@desktop/main/adapters/secrets/private-file.ts'
import {
  createRecordSecretStore,
  type SecretRecord
} from '@desktop/main/adapters/secrets/record-secret-store.ts'
import type { SecretStore } from '@loadstar/kernel'
import { utf8Decode, utf8Encode } from '@loadstar/kernel'

/** The sealed file, or undefined when there is none yet. */
const readSealed = async (path: string): Promise<Uint8Array | undefined> => {
  try {
    return new Uint8Array(await readFile(path))
  } catch {
    return undefined
  }
}

export const createEncryptedFileSecretStore = (
  path: string,
  keyProvider: KeyProvider
): SecretStore => {
  let key: Promise<CryptoKey> | undefined
  let cache: SecretRecord | undefined

  const cryptoKey = (): Promise<CryptoKey> => {
    key ??= keyProvider().then(importAesKey)
    return key
  }

  const load = async (): Promise<SecretRecord> => {
    if (cache) return cache
    const sealed = await readSealed(path)
    cache = sealed
      ? (JSON.parse(
          utf8Decode(await unseal(await cryptoKey(), sealed))
        ) as SecretRecord)
      : {}
    return cache
  }

  const save = async (values: SecretRecord) =>
    writePrivateFile(
      path,
      await seal(await cryptoKey(), utf8Encode(JSON.stringify(values)))
    )

  return createRecordSecretStore({ load, save })
}
