import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { fromHex, toHex } from '@loadstar/kernel'

const run = promisify(execFile)
const KEY_BYTES = 32

/** Supplies the file key (32 bytes), creating it on first use. */
export type KeyProvider = () => Promise<Uint8Array>

/**
 * macOS login keychain. The key is created once (generic password `service`/`account`) and read back with
 * `security find-generic-password -w`; macOS may ask the user to allow access.
 */
export const macKeychainKey =
  (service: string, account = 'file-key'): KeyProvider =>
  async () => {
    try {
      const { stdout } = await run('security', [
        'find-generic-password',
        '-s',
        service,
        '-a',
        account,
        '-w'
      ])

      return fromHex(stdout.trim())
    } catch {
      const key = globalThis.crypto.getRandomValues(new Uint8Array(KEY_BYTES))
      await run('security', [
        'add-generic-password',
        '-s',
        service,
        '-a',
        account,
        '-w',
        toHex(key),
        '-U'
      ])
      return key
    }
  }
