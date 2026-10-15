// An `AppleSession` as bytes for the secret store: JSON with its binary fields in base64.

import { z } from 'zod'

import type { AppleSession } from '@apple/domain/session.ts'
import { nonEmpty } from '@apple/domain/values.ts'
import {
  compact,
  fromBase64,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@loadstar/kernel'

const sessionSchema = z.object({
  appleId: z.string(),
  adsid: z.string(),
  idmsToken: z.string(),
  sessionKey: z.string(),
  cookie: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  anisetteServer: z.string()
})

export const encodeSession = (session: AppleSession): Uint8Array =>
  utf8Encode(
    JSON.stringify({
      ...session,
      sessionKey: toBase64(session.sessionKey),
      cookie: toBase64(session.cookie)
    })
  )

/** The stored session, or `undefined` when the entry is not one. */
export const decodeSession = (bytes: Uint8Array): AppleSession | undefined => {
  const parsed = sessionSchema.safeParse(JSON.parse(utf8Decode(bytes)))
  if (!parsed.success) return undefined
  const { sessionKey, cookie, firstName, lastName, ...rest } = parsed.data

  return compact({
    ...rest,
    sessionKey: fromBase64(sessionKey),
    cookie: fromBase64(cookie),
    firstName: nonEmpty(firstName),
    lastName: nonEmpty(lastName)
  })
}
