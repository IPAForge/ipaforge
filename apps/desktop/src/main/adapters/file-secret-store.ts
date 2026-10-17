// A SecretStore backed by one JSON file readable only by the user (0600). Development tooling only: Phase 9 puts
// app secrets behind the OS keychain (Electron safeStorage). Keys are base64-encoded values.
import { readFile } from 'node:fs/promises'

import { writePrivateFile } from '@desktop/main/adapters/secrets/private-file.ts'
import {
  createRecordSecretStore,
  type SecretRecord
} from '@desktop/main/adapters/secrets/record-secret-store.ts'
import type { SecretStore } from '@loadstar/kernel'

export const createFileSecretStore = (path: string): SecretStore => {
  const read = async (): Promise<SecretRecord> => {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as SecretRecord
    } catch {
      return {}
    }
  }
  // One load for every caller: concurrent first uses share the same record instead of each reading its own.
  let loading: Promise<SecretRecord> | undefined
  const load = (): Promise<SecretRecord> => {
    loading ??= read()
    return loading
  }
  const save = (values: SecretRecord) =>
    writePrivateFile(path, JSON.stringify(values))

  return createRecordSecretStore({ load, save })
}
