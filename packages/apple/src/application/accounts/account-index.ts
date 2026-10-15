// The saved-accounts index: a versioned JSON document in the secret store. An unreadable index reads as empty.

import { z } from 'zod'

import { type SecretStore, utf8Decode, utf8Encode } from '@loadstar/kernel'

const INDEX_KEY = 'apple/accounts'
const INDEX_VERSION = 1

const accountSchema = z.object({
  id: z.string(),
  appleId: z.string(),
  displayName: z.string().optional(),
  teamId: z.string().optional(),
  health: z.object({
    lastSuccessAt: z.string().optional(),
    bannedOnDevices: z.array(z.string()),
    lastError: z.string().optional()
  })
})

const indexSchema = z.object({
  version: z.literal(INDEX_VERSION),
  active: z.string().optional(),
  accounts: z.array(accountSchema)
})

export type AccountIndex = z.infer<typeof indexSchema>

const emptyIndex = (): AccountIndex => ({
  version: INDEX_VERSION,
  accounts: []
})

export const readIndex = async (
  secrets: SecretStore
): Promise<AccountIndex> => {
  const raw = await secrets.get(INDEX_KEY)
  if (!raw) return emptyIndex()
  const parsed = indexSchema.safeParse(JSON.parse(utf8Decode(raw)))

  return parsed.success ? parsed.data : emptyIndex()
}

export const writeIndex = (
  secrets: SecretStore,
  index: AccountIndex
): Promise<void> => secrets.set(INDEX_KEY, utf8Encode(JSON.stringify(index)))
