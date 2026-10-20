import { toHex, trimEndChar } from '@ipaforge/kernel'

export const ANISETTE_IDENTIFIER_BYTES = 16

/** `X-Apple-I-SRL-NO`: anisette clients report no machine serial. */
export const ANISETTE_SERIAL_NUMBER = '0'
/** `X-Apple-I-TimeZone` for machine headers built on this computer. */
export const ANISETTE_TIME_ZONE = 'UTC'

/** `X-Mme-Device-Id`: the identifier's 16 bytes as a standard (lower-case) UUID. */
export const deviceIdFor = (identifier: Uint8Array): string => {
  const hex = toHex(identifier).padEnd(32, '0').slice(0, 32)

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** `X-Apple-I-MD-LU`: the local user id, SHA-256 of the identifier in lower-case hex. */
export const localUserIdFor = async (identifier: Uint8Array): Promise<string> =>
  toHex(
    new Uint8Array(
      await globalThis.crypto.subtle.digest(
        'SHA-256',
        identifier as Uint8Array<ArrayBuffer>
      )
    )
  )

/** Apple's timestamp format (`2026-10-15T07:00:00Z`, no milliseconds). */
export const appleTimestamp = (date: Date): string =>
  `${date.toISOString().slice(0, 19)}Z`

/** Placeholder hosts people leave in "custom server" fields. */
const PLACEHOLDER_HOSTS = /(^|\.)(yourserver|example)\.(com|org|net)$/i

/** Validates a user-entered anisette server URL. Returns the normalised base URL or an error message. */
export const validateServerUrl = (
  input: string
): { ok: true; url: string } | { ok: false; reason: string } => {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { ok: false, reason: 'not a URL' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { ok: false, reason: 'use http:// or https://' }
  // A user name or password in the address would be saved and logged with it.
  if (url.username || url.password)
    return { ok: false, reason: 'no user name or password in the address' }
  if (PLACEHOLDER_HOSTS.test(url.hostname)) {
    return {
      ok: false,
      reason: 'this is a placeholder address; enter a real anisette server'
    }
  }
  return { ok: true, url: trimEndChar(url.toString(), '/') }
}
