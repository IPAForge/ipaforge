// The anisette servers Settings shows and changes: the order Automatic tries them in, the user's choice, the
// servers they add, edit and remove, and a test of any one of them. A server the user adds is used first: at the
// top in Automatic, and the chosen one when they pick servers themselves.

import { dedupe } from '@apple/application/anisette/server-list.ts'
import type {
  AnisetteChoice,
  AnisetteOverview,
  AnisetteServerEntry,
  AnisetteServerInput,
  AnisetteSettings,
  AnisetteSettingsStore,
  RemoteServerList
} from '@apple/application/anisette/types.ts'
import { validateServerUrl } from '@apple/domain/anisette.ts'
import type { AnisetteServer } from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const MAX_NAME_LENGTH = 80

export type ServerCatalog = {
  readonly deps: AppleDeps
  readonly settings: AnisetteSettingsStore
  readonly remoteList: RemoteServerList
  /** A server configured by the host (a probe's command line), first among the ones added. */
  readonly configured?: AnisetteServer
}

const sameAddress = (a: string, b: string): boolean =>
  dedupe([
    { name: '', address: a },
    { name: '', address: b }
  ]).length === 1

/** Added by the user (newest first), then SideStore's list in its order, then the built-in servers it lacks. */
export const serverEntries = async (
  catalog: ServerCatalog,
  settings: AnisetteSettings
): Promise<AnisetteServerEntry[]> => {
  const tag =
    (source: AnisetteServerEntry['source']) =>
    (server: AnisetteServer): AnisetteServerEntry => ({ ...server, source })
  const all = [
    ...(catalog.configured ? [catalog.configured] : []).map(tag('custom')),
    ...settings.custom.map(tag('custom')),
    ...(await catalog.remoteList.current()).map(tag('list')),
    ...catalog.deps.config.fallbackAnisetteServers.map(tag('backup'))
  ]

  return dedupe(all) as AnisetteServerEntry[]
}

export const overview = async (
  catalog: ServerCatalog,
  lastUsed: string | undefined
): Promise<AnisetteOverview> => {
  const settings = await catalog.settings.load()
  const servers = await serverEntries(catalog, settings)
  const list = await catalog.remoteList.snapshot()

  return {
    servers,
    choice: settings.choice,
    ...(lastUsed ? { lastUsed } : {}),
    ...(list ? { listUpdatedAt: list.fetchedAt } : {}),
    skipped: list?.skipped ?? []
  }
}

const invalid = (reason: string): IPAForgeError =>
  new IPAForgeError(ErrorCode.AnisetteServerInvalid, {
    message: reason,
    data: { reason }
  })

/** The server as typed, checked: a name, an http(s) address that isn't a placeholder, and not in the list yet. */
const checkedServer = async (
  catalog: ServerCatalog,
  settings: AnisetteSettings,
  input: AnisetteServerInput,
  replacing?: string
): Promise<AnisetteServer> => {
  const name = input.name.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw invalid('name')
  const url = validateServerUrl(input.address)
  if (!url.ok) throw invalid(url.reason)
  const taken = (await serverEntries(catalog, settings)).some(
    (server) =>
      sameAddress(server.address, url.url) &&
      !(replacing !== undefined && sameAddress(server.address, replacing))
  )
  if (taken)
    throw new IPAForgeError(ErrorCode.AnisetteServerExists, {
      data: { address: url.url }
    })

  return { name, address: url.url }
}

const isChosen = (choice: AnisetteChoice, address: string): boolean =>
  choice.mode === 'chosen' &&
  choice.server !== undefined &&
  sameAddress(choice.server.address, address)

export const addServer = async (
  catalog: ServerCatalog,
  input: AnisetteServerInput
): Promise<void> => {
  const settings = await catalog.settings.load()
  const server = await checkedServer(catalog, settings, input)
  await catalog.settings.save({
    choice:
      settings.choice.mode === 'chosen'
        ? { mode: 'chosen', server }
        : settings.choice,
    custom: [server, ...settings.custom]
  })
  catalog.deps.logger.info('anisette server added', { server: server.name })
}

const findCustom = (settings: AnisetteSettings, address: string) => {
  const found = settings.custom.find((server) =>
    sameAddress(server.address, address)
  )
  if (!found) throw invalid('not_added')
  return found
}

export const updateServer = async (
  catalog: ServerCatalog,
  address: string,
  input: AnisetteServerInput
): Promise<void> => {
  const settings = await catalog.settings.load()
  const old = findCustom(settings, address)
  const server = await checkedServer(catalog, settings, input, old.address)
  await catalog.settings.save({
    choice: isChosen(settings.choice, old.address)
      ? { mode: 'chosen', server }
      : settings.choice,
    custom: settings.custom.map((candidate) =>
      candidate === old ? server : candidate
    )
  })
}

/** Forgets a server the user added; when it was the chosen one, nothing is chosen (IPAForge picks by itself). */
export const removeServer = async (
  catalog: ServerCatalog,
  address: string
): Promise<AnisetteServer> => {
  const settings = await catalog.settings.load()
  const old = findCustom(settings, address)
  await catalog.settings.save({
    choice: isChosen(settings.choice, old.address)
      ? { mode: 'chosen' }
      : settings.choice,
    custom: settings.custom.filter((candidate) => candidate !== old)
  })
  return old
}

export const choose = async (
  catalog: ServerCatalog,
  choice: AnisetteChoice
): Promise<void> => {
  const settings = await catalog.settings.load()
  const known =
    choice.mode === 'chosen' && choice.server
      ? (await serverEntries(catalog, settings)).find((server) =>
          sameAddress(server.address, choice.server?.address ?? '')
        )
      : undefined
  if (choice.mode === 'chosen' && choice.server && !known)
    throw invalid('not_listed')
  await catalog.settings.save({
    ...settings,
    choice: known
      ? { mode: 'chosen', server: { name: known.name, address: known.address } }
      : choice
  })
  catalog.deps.logger.info('anisette choice changed', {
    mode: choice.mode,
    ...(known ? { server: known.name } : {})
  })
}

/** A server to test: one in the list, or an address being typed into Add server (checked like one). */
export const serverToTest = async (
  catalog: ServerCatalog,
  address: string
): Promise<AnisetteServer> => {
  const settings = await catalog.settings.load()
  const known = (await serverEntries(catalog, settings)).find((server) =>
    sameAddress(server.address, address)
  )
  if (known) return known
  const url = validateServerUrl(address)
  if (!url.ok) throw invalid(url.reason)
  return { name: url.url, address: url.url }
}
