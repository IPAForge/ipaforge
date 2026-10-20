// A remote pairing as kept in the secret store (JSON, bytes in base64), and as SideStore's remote pairing file
// (`PairingFile_RemoteRP.plist`: this computer's Ed25519 keys, its identifier and the device's identity resolving
// key; nothing of the classic pairing, which goes in its own file).
import { z } from 'zod'

import type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'
import {
  createDict,
  fromBase64,
  serializeXmlPlist,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

/** Where a device's remote pairing is kept in the secret store (encrypted, like the pair record). */
export const remotePairingSecretKey = (udid: string): string =>
  `remote-pairing/${udid}`

const storedSchema = z.object({
  identifier: z.string().min(1),
  publicKey: z.string(),
  privateKey: z.string(),
  deviceIdentifier: z.string().min(1),
  devicePublicKey: z.string(),
  altIrk: z.string()
})

const KEY_BYTES = 32

export const serializeRemotePairing = (record: RemotePairingRecord) =>
  utf8Encode(
    JSON.stringify({
      identifier: record.identifier,
      publicKey: toBase64(record.publicKey),
      privateKey: toBase64(record.privateKey),
      deviceIdentifier: record.deviceIdentifier,
      devicePublicKey: toBase64(record.devicePublicKey),
      altIrk: toBase64(record.altIrk)
    })
  )

/** The stored pairing, or undefined when it is missing or unreadable (a new one is made then). */
export const parseRemotePairing = (
  bytes: Uint8Array | undefined
): RemotePairingRecord | undefined => {
  if (!bytes) return undefined
  try {
    const parsed = storedSchema.safeParse(JSON.parse(utf8Decode(bytes)))
    if (!parsed.success) return undefined
    const record: RemotePairingRecord = {
      identifier: parsed.data.identifier,
      publicKey: fromBase64(parsed.data.publicKey),
      privateKey: fromBase64(parsed.data.privateKey),
      deviceIdentifier: parsed.data.deviceIdentifier,
      devicePublicKey: fromBase64(parsed.data.devicePublicKey),
      altIrk: fromBase64(parsed.data.altIrk)
    }
    const keysFit = [
      record.publicKey,
      record.privateKey,
      record.devicePublicKey
    ].every((key) => key.byteLength === KEY_BYTES)

    return keysFit ? record : undefined
  } catch {
    return undefined
  }
}

/** SideStore's `PairingFile_RemoteRP.plist`: only the remote pairing's keys, so the file isn't ambiguous. */
export const remotePairingFile = (record: RemotePairingRecord): Uint8Array =>
  serializeXmlPlist(
    createDict([
      ['alt_irk', record.altIrk],
      ['identifier', record.identifier],
      ['private_key', record.privateKey],
      ['public_key', record.publicKey]
    ])
  )
