// Where the app keeps its secrets. Accounts, sessions, passwords and certificate keys go to one AES-256-GCM
// encrypted file whose key safeStorage protects with the OS keychain. Where the OS offers no real keychain
// (Linux without a secret service) they stay in memory for this session only, never on disk in the clear. The
// anisette (machine) identity is not a credential and goes to a 0600 file, so Apple sees the same machine on
// every launch. The keychain is first touched when a secret is, never while the app starts: on macOS that can ask
// for the login password, and the window must already be open by then.
import { join } from 'node:path'

import { createEncryptedFileSecretStore } from '@desktop/main/adapters/encrypted-file-secret-store.ts'
import { createFileSecretStore } from '@desktop/main/adapters/file-secret-store.ts'
import { createMemorySecretStore } from '@desktop/main/adapters/memory-secret-store.ts'
import { createRoutedSecretStore } from '@desktop/main/adapters/routed-secret-store.ts'
import {
  isSafeStorageUsable,
  type SafeStorageLike,
  safeStorageKey
} from '@desktop/main/adapters/secrets/safe-storage-key.ts'
import type { Logger, SecretStore } from '@ipaforge/kernel'

const ANISETTE_PREFIX = 'anisette/'

export type DesktopSecretsOptions = {
  readonly dataDir: string
  readonly safeStorage: SafeStorageLike
  readonly platform: NodeJS.Platform
  readonly logger: Logger
}

const openSensitiveStore = ({
  dataDir,
  safeStorage,
  platform,
  logger
}: DesktopSecretsOptions): SecretStore => {
  if (!isSafeStorageUsable(safeStorage, platform)) {
    logger.warn('no OS keychain: accounts are kept for this session only')
    const memory = createMemorySecretStore()

    return { ...memory, isPersistent: async () => false }
  }
  return {
    ...createEncryptedFileSecretStore(
      join(dataDir, 'secrets.enc'),
      safeStorageKey(safeStorage, join(dataDir, 'secrets.key'))
    ),
    isPersistent: async () => true
  }
}

/** Opens the store on first use, so the keychain is asked once, when a secret is needed. */
const sensitiveStore = (options: DesktopSecretsOptions): SecretStore => {
  let store: SecretStore | undefined
  const open = () => {
    store ??= openSensitiveStore(options)
    return store
  }

  return {
    get: (key) => open().get(key),
    set: (key, value) => open().set(key, value),
    delete: (key) => open().delete(key),
    isPersistent: async () => (await open().isPersistent?.()) ?? true
  }
}

export const createDesktopSecrets = (
  options: DesktopSecretsOptions
): SecretStore =>
  createRoutedSecretStore(
    [ANISETTE_PREFIX],
    createFileSecretStore(join(options.dataDir, 'anisette.json')),
    sensitiveStore(options)
  )
