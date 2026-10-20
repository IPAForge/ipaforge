// What the user set for anisette servers, in the store beside the machine identity (not a secret): the choice and
// the servers they added. Unreadable or missing settings are the defaults: Automatic, nothing added.

import { z } from 'zod'

import type {
  AnisetteSettings,
  AnisetteSettingsStore
} from '@apple/application/anisette/types.ts'
import {
  compact,
  type Logger,
  type SecretStore,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const SETTINGS_KEY = 'anisette/settings'

const DEFAULT_SETTINGS: AnisetteSettings = {
  choice: { mode: 'automatic' },
  custom: []
}

const serverSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1)
})

const settingsSchema = z.object({
  choice: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('automatic') }),
    z.object({ mode: z.literal('chosen'), server: serverSchema.optional() })
  ]),
  custom: z.array(serverSchema)
})

export const createAnisetteSettingsStore = (
  secrets: SecretStore,
  logger: Logger
): AnisetteSettingsStore => ({
  load: async () => {
    try {
      const raw = await secrets.get(SETTINGS_KEY)
      if (!raw) return DEFAULT_SETTINGS
      const parsed = settingsSchema.safeParse(JSON.parse(utf8Decode(raw)))
      if (parsed.success)
        return {
          choice: compact(parsed.data.choice),
          custom: parsed.data.custom
        }
    } catch (error) {
      logger.warn('anisette settings unreadable; using the defaults', {
        cause: error
      })
    }
    return DEFAULT_SETTINGS
  },
  save: (settings) =>
    secrets.set(SETTINGS_KEY, utf8Encode(JSON.stringify(settings)))
})
