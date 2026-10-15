// The SecretStore operations shared by the file-backed stores: every secret lives base64-encoded in one
// `name → value` record that the store loads once and saves whole after each change.
import type { SecretStore } from '@loadstar/kernel'
import { fromBase64, toBase64 } from '@loadstar/kernel'

export type SecretRecord = Record<string, string>

export type SecretRecordStorage = {
  /** Returns the cached record, loading it on first use. */
  readonly load: () => Promise<SecretRecord>
  readonly save: (values: SecretRecord) => Promise<void>
}

export const createRecordSecretStore = ({
  load,
  save
}: SecretRecordStorage): SecretStore => ({
  get: async (key) => {
    const value = (await load())[key]

    return value === undefined ? undefined : fromBase64(value)
  },
  set: async (key, value) => {
    const values = await load()
    values[key] = toBase64(value)
    await save(values)
  },
  delete: async (key) => {
    const values = await load()
    if (!(key in values)) return
    delete values[key]
    await save(values)
  }
})
