// The SecretStore operations shared by the file-backed stores: every secret lives base64-encoded in one
// `name → value` record that the store loads once and saves whole after each change. Saves run one at a time, so
// two changes in flight never write the same temporary file at once.

import type {
  SecretRecord,
  SecretRecordStorage
} from '@desktop/main/adapters/secrets/types.ts'
import type { SecretStore } from '@loadstar/kernel'
import { fromBase64, toBase64 } from '@loadstar/kernel'

export const createRecordSecretStore = ({
  load,
  save
}: SecretRecordStorage): SecretStore => {
  let saving: Promise<void> = Promise.resolve()
  const persist = (values: SecretRecord): Promise<void> => {
    const next = saving.then(
      () => save(values),
      () => save(values)
    )
    saving = next
    return next
  }

  return {
    get: async (key) => {
      const value = (await load())[key]

      return value === undefined ? undefined : fromBase64(value)
    },
    set: async (key, value) => {
      const values = await load()
      values[key] = toBase64(value)
      await persist(values)
    },
    delete: async (key) => {
      const values = await load()
      if (!(key in values)) return
      delete values[key]
      await persist(values)
    }
  }
}
