// Anisette servers for the fake Engine: SideStore's list as it looks today (one plain-HTTP entry left out), the
// built-in backup it lacks, and servers added by hand. Addresses with "down" in them, and two of the list's, don't
// answer a test, so every status can be seen; the others answer in a time worked out from the address.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { Engine } from '@ipaforge/rpc'
import type {
  AnisetteChoice,
  AnisetteOverview,
  AnisetteServerEntry
} from '@ui/services/engine/types.ts'

const LIST: AnisetteServerEntry[] = [
  ['SideStore', 'https://ani.sidestore.io'],
  ['SideStore (.app)', 'https://ani.sidestore.app'],
  ['SideStore (.zip)', 'https://ani.sidestore.zip'],
  ['SideStore (Windows ADI)', 'https://win.ani.sidestore.io'],
  ['jkcoxson', 'https://mac-ani.jkcoxson.com'],
  ['nythepegasus', 'https://ani.npeg.us'],
  ['WE. Studio', 'https://anisette.wedotstud.io']
].map(([name = '', address = '']) => ({ name, address, source: 'list' }))

const BACKUP: AnisetteServerEntry[] = [
  { name: 'StikStore', address: 'https://ani3.stikstore.app', source: 'backup' }
]

const DOWN = ['https://ani.sidestore.zip', 'https://anisette.wedotstud.io']

const LIST_AGE_MS = 12 * 60_000

/** A steady answer time per address, between 90 and 610 ms. */
const latencyOf = (address: string): number => {
  let hash = 0
  for (const char of address) hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  return 90 + (hash % 520)
}

/** The address without trailing slashes. */
const trimmed = (address: string): string => {
  let end = address.length
  while (end > 0 && address[end - 1] === '/') end -= 1

  return address.slice(0, end)
}

const key = (address: string) => trimmed(address).toLowerCase()

type AnisetteQueries = Pick<
  Engine,
  | 'anisetteServers'
  | 'chooseAnisetteServer'
  | 'addAnisetteServer'
  | 'updateAnisetteServer'
  | 'removeAnisetteServer'
  | 'testAnisetteServer'
  | 'updateAnisetteServerList'
>

export const createFakeAnisette = (
  wait: () => Promise<void>,
  now: () => number = Date.now
): AnisetteQueries => {
  let custom: AnisetteServerEntry[] = []
  let choice: AnisetteChoice = { mode: 'automatic' }
  let listUpdatedAt = now() - LIST_AGE_MS

  const overview = (): AnisetteOverview => ({
    servers: [...custom, ...LIST, ...BACKUP],
    choice,
    lastUsed: 'https://ani.sidestore.io',
    listUpdatedAt,
    skipped: ['Macley']
  })
  const checked = (
    input: { name: string; address: string },
    replacing?: string
  ): AnisetteServerEntry => {
    const name = input.name.trim()
    const address = trimmed(input.address.trim())
    if (!(name && URL.canParse(address) && address.startsWith('http')))
      throw new IPAForgeError(ErrorCode.AnisetteServerInvalid)
    const taken = overview().servers.some(
      (server) =>
        key(server.address) === key(address) &&
        key(server.address) !== key(replacing ?? '')
    )
    if (taken) throw new IPAForgeError(ErrorCode.AnisetteServerExists)
    return { name, address, source: 'custom' }
  }
  const isChosen = (address: string) =>
    choice.mode === 'chosen' &&
    choice.server !== undefined &&
    key(choice.server.address) === key(address)

  return {
    anisetteServers: async () => overview(),
    chooseAnisetteServer: async (next) => {
      choice = next
      return overview()
    },
    addAnisetteServer: async (input) => {
      const server = checked(input)
      custom = [server, ...custom]
      if (choice.mode === 'chosen')
        choice = {
          mode: 'chosen',
          server: { name: server.name, address: server.address }
        }
      return overview()
    },
    updateAnisetteServer: async (address, input) => {
      const server = checked(input, address)
      if (isChosen(address))
        choice = {
          mode: 'chosen',
          server: { name: server.name, address: server.address }
        }
      custom = custom.map((old) =>
        key(old.address) === key(address) ? server : old
      )
      return overview()
    },
    removeAnisetteServer: async (address) => {
      if (isChosen(address)) choice = { mode: 'chosen' }
      custom = custom.filter((old) => key(old.address) !== key(address))
      return overview()
    },
    testAnisetteServer: async (address) => {
      await wait()
      const isDown = address.includes('down') || DOWN.includes(key(address))

      return isDown
        ? { address, ok: false }
        : { address, ok: true, latencyMs: latencyOf(address) }
    },
    updateAnisetteServerList: async () => {
      await wait()
      listUpdatedAt = now()
      return overview()
    }
  }
}
