// What the anisette service keeps in the secret store: each server's provisioning state, and the server that
// worked last (tried first next time).

import { z } from 'zod'

import type { AnisetteState } from '@apple/domain/anisette.ts'
import type { AnisetteServer } from '@apple/domain/config.ts'
import {
  compact,
  fromBase64,
  type SecretStore,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@loadstar/kernel'

const LAST_GOOD_KEY = 'anisette/last-good'
const stateKey = (server: AnisetteServer): string =>
  `anisette/state/${new URL(server.address).host}`

const stateSchema = z.object({
  identifier: z.string(),
  adiPb: z.string().optional()
})

export type AnisetteStateStore = {
  load(server: AnisetteServer): Promise<AnisetteState | undefined>
  save(server: AnisetteServer, state: AnisetteState): Promise<void>
  forget(server: AnisetteServer): Promise<void>
  lastGood(): Promise<string | undefined>
  setLastGood(address: string): Promise<void>
  forgetLastGood(): Promise<void>
}

export const createAnisetteStateStore = (
  secrets: SecretStore
): AnisetteStateStore => ({
  load: async (server) => {
    const raw = await secrets.get(stateKey(server))
    if (!raw) return undefined
    const parsed = stateSchema.safeParse(JSON.parse(utf8Decode(raw)))
    if (!parsed.success) return undefined
    const { identifier, adiPb } = parsed.data

    return compact({
      identifier: fromBase64(identifier),
      adiPb: adiPb ? fromBase64(adiPb) : undefined
    })
  },
  save: (server, state) =>
    secrets.set(
      stateKey(server),
      utf8Encode(
        JSON.stringify(
          compact({
            identifier: toBase64(state.identifier),
            adiPb: state.adiPb ? toBase64(state.adiPb) : undefined
          })
        )
      )
    ),
  forget: (server) => secrets.delete(stateKey(server)),
  lastGood: async () => {
    const raw = await secrets.get(LAST_GOOD_KEY)

    return raw ? utf8Decode(raw) : undefined
  },
  setLastGood: (address) => secrets.set(LAST_GOOD_KEY, utf8Encode(address)),
  forgetLastGood: () => secrets.delete(LAST_GOOD_KEY)
})
