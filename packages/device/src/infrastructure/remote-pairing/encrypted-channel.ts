// After pair-verify on a network connection, remote pairing's messages are encrypted: each JSON body sealed with
// ChaCha20-Poly1305 under a key per direction (HKDF-SHA512 of the pair-verify secret, no salt, info
// `ClientEncrypt-main` / `ServerEncrypt-main`), the nonce being each direction's message count as 8 little-endian
// bytes then 4 zero bytes, sent base64 as `streamEncrypted._0`. Checked against iPhones on iOS 18.2 and 26.6.1.
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha512 } from '@noble/hashes/sha2.js'

import { isRecord } from '@device/domain/remote-pairing/json.ts'
import type { PairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import {
  ErrorCode,
  fromBase64,
  IPAForgeError,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const KEY_BYTES = 32
const NONCE_BYTES = 12
const CLIENT_KEY_INFO = 'ClientEncrypt-main'
const SERVER_KEY_INFO = 'ServerEncrypt-main'
/** Plain events (such as consent prompts) the device may send before its encrypted answer. */
const MAX_SKIPPED_MESSAGES = 16

export type EncryptedChannel = {
  /** Sends `body` encrypted and returns the device's next encrypted body, opened. */
  request(body: Record<string, unknown>): Promise<Record<string, unknown>>
}

const keyFor = (secret: Uint8Array, info: string) =>
  hkdf(sha512, secret, new Uint8Array(0), utf8Encode(info), KEY_BYTES)

const nonceFor = (counter: number): Uint8Array => {
  const nonce = new Uint8Array(NONCE_BYTES)
  new DataView(nonce.buffer).setBigUint64(0, BigInt(counter), true)
  return nonce
}

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `remote pairing: ${message}`
  })

export const createEncryptedChannel = (
  channel: PairingChannel,
  secret: Uint8Array
): EncryptedChannel => {
  const sendKey = keyFor(secret, CLIENT_KEY_INFO)
  const receiveKey = keyFor(secret, SERVER_KEY_INFO)
  let sent = 0
  let received = 0

  const open = (sealed: string): Record<string, unknown> => {
    let body: unknown
    try {
      const plain = chacha20poly1305(receiveKey, nonceFor(received)).decrypt(
        fromBase64(sealed)
      )
      body = JSON.parse(utf8Decode(plain))
    } catch {
      throw malformed("an encrypted message that doesn't open")
    }
    received += 1
    if (!isRecord(body)) throw malformed('an encrypted message without a body')
    return body
  }

  return {
    request: async (body) => {
      const sealed = chacha20poly1305(sendKey, nonceFor(sent)).encrypt(
        utf8Encode(JSON.stringify(body))
      )
      sent += 1
      await channel.sendMessage({ streamEncrypted: { _0: toBase64(sealed) } })
      for (let skipped = 0; skipped < MAX_SKIPPED_MESSAGES; skipped++) {
        const message = await channel.receiveMessage()
        const encrypted = message.streamEncrypted
        if (isRecord(encrypted) && typeof encrypted._0 === 'string')
          return open(encrypted._0)
      }
      throw malformed('no encrypted answer')
    }
  }
}
