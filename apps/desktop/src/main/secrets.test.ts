import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  isSafeStorageUsable,
  type SafeStorageLike,
  safeStorageKey
} from '@desktop/main/adapters/secrets/safe-storage-key.ts'
import { createDesktopSecrets } from '@desktop/main/secrets.ts'
import { silentLogger, utf8Decode, utf8Encode } from '@ipaforge/kernel'

const dirs: string[] = []
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ipaforge-secrets-'))
  dirs.push(dir)
  return dir
}
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true })
})

/** "Encrypts" by reversing the text, so a test can tell sealed from plain. */
const fakeSafeStorage = (
  options: { available?: boolean; backend?: string } = {}
): SafeStorageLike => ({
  isEncryptionAvailable: () => options.available ?? true,
  encryptString: (text) => utf8Encode([...text].reverse().join('')),
  decryptString: (bytes) => [...utf8Decode(bytes)].reverse().join(''),
  getSelectedStorageBackend: () => options.backend ?? 'gnome_libsecret'
})

describe('safeStorageKey', () => {
  it('creates the key once, keeps it sealed, and reads the same key back', async () => {
    const path = join(await tempDir(), 'secrets.key')
    const safeStorage = fakeSafeStorage()
    const key = await safeStorageKey(safeStorage, path)()
    expect(key).toHaveLength(32)

    const sealed = utf8Decode(new Uint8Array(await readFile(path)))
    expect(sealed).toHaveLength(64)
    expect(await safeStorageKey(safeStorage, path)()).toEqual(key)
  })
})

describe('isSafeStorageUsable', () => {
  it('refuses Linux without a keyring, where safeStorage protects nothing', () => {
    expect(isSafeStorageUsable(fakeSafeStorage(), 'linux')).toBe(true)
    expect(
      isSafeStorageUsable(fakeSafeStorage({ backend: 'basic_text' }), 'linux')
    ).toBe(false)
    expect(
      isSafeStorageUsable(fakeSafeStorage({ available: false }), 'darwin')
    ).toBe(false)
  })
})

describe('createDesktopSecrets', () => {
  it('keeps credentials encrypted on disk and the anisette identity in its own file', async () => {
    const dataDir = await tempDir()
    const options = {
      dataDir,
      safeStorage: fakeSafeStorage(),
      platform: 'darwin' as const,
      logger: silentLogger
    }
    const secrets = createDesktopSecrets(options)
    await secrets.set('apple/password/someone', utf8Encode('hunter2'))
    await secrets.set('anisette/identity', utf8Encode('machine'))

    const sealed = await readFile(join(dataDir, 'secrets.enc'))
    expect(sealed.includes('hunter2')).toBe(false)
    expect(await readFile(join(dataDir, 'anisette.json'), 'utf8')).toBeDefined()

    const reopened = createDesktopSecrets(options)
    expect(
      utf8Decode(
        (await reopened.get('apple/password/someone')) ?? new Uint8Array()
      )
    ).toBe('hunter2')
  })

  it('keeps credentials in memory only without a usable keychain', async () => {
    const dataDir = await tempDir()
    const options = {
      dataDir,
      safeStorage: fakeSafeStorage({ backend: 'basic_text' }),
      platform: 'linux' as const,
      logger: silentLogger
    }
    await createDesktopSecrets(options).set(
      'apple/session/someone',
      utf8Encode('token')
    )
    await expect(readFile(join(dataDir, 'secrets.enc'))).rejects.toThrow()
    expect(
      await createDesktopSecrets(options).get('apple/session/someone')
    ).toBeUndefined()
  })
})

describe('the secret stores under concurrent use', () => {
  const keys = ['apple/account-index', 'apple/session/a', 'apple/session/b']

  it('keeps every change made at once on a fresh store, and reads them back', async () => {
    const dataDir = await tempDir()
    const options = {
      dataDir,
      safeStorage: fakeSafeStorage(),
      platform: 'darwin' as const,
      logger: silentLogger
    }
    const secrets = createDesktopSecrets(options)
    await Promise.all([
      ...keys.map((key) => secrets.set(key, utf8Encode(key))),
      secrets.set('anisette/last-good', utf8Encode('a')),
      secrets.set('anisette/state/a', utf8Encode('b'))
    ])

    const reopened = createDesktopSecrets(options)
    for (const key of [...keys, 'anisette/last-good', 'anisette/state/a'])
      expect(await reopened.get(key)).toBeDefined()
    expect(
      utf8Decode((await reopened.get(keys[1] ?? '')) ?? new Uint8Array())
    ).toBe(keys[1])
  })
})
