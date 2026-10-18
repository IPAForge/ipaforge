// Which anisette servers to try, in which order: a custom server first, then the built-in fallback, then the
// remote community list. The remote list is kept up to date: fetched again once it is older than its maximum age
// (on the next anisette request, never polled), and the last list fetched is kept in the secret store, so a failed
// fetch or an offline start uses it instead of the built-in servers alone.

import { z } from 'zod'

import type {
  FetchedList,
  RemoteServerList
} from '@apple/application/anisette/types.ts'
import type { AnisetteServer } from '@apple/domain/types.ts'
import { fetchApple } from '@apple/infrastructure/http.ts'
import type { AppleDeps } from '@apple/types.ts'
import { compact, utf8Decode, utf8Encode } from '@ipaforge/kernel'

const serverListSchema = z.looseObject({
  servers: z.array(z.looseObject({ name: z.string().min(1), address: z.url() }))
})

/** The address without trailing slashes; a loop, not a regex, so a hostile address can't make it backtrack. */
const withoutTrailingSlashes = (address: string): string => {
  let end = address.length
  while (end > 0 && address[end - 1] === '/') end -= 1

  return address.slice(0, end)
}

const serverKey = (server: AnisetteServer): string =>
  withoutTrailingSlashes(server.address).toLowerCase()

/** Keeps the first of servers with the same address (ignoring case and trailing slashes). */
export const dedupe = (
  servers: readonly AnisetteServer[]
): AnisetteServer[] => {
  const seen = new Set<string>()

  return servers.filter((server) => {
    const key = serverKey(server)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * The remote list is untrusted input: an anisette server sees this machine's identity and relays its
 * provisioning, so only HTTPS servers are accepted from it. Plain HTTP is allowed only for a server the
 * user configured explicitly (e.g. a local sidecar).
 */
const httpsOnly = (
  deps: AppleDeps,
  servers: readonly AnisetteServer[]
): AnisetteServer[] =>
  servers.filter((server) => {
    const secure = server.address.startsWith('https://')
    if (!secure)
      deps.logger.warn(
        'ignoring non-HTTPS anisette server from the remote list',
        { server: server.name }
      )
    return secure
  })

/** The remote list's HTTPS servers, or undefined when it cannot be fetched. */
const fetchRemoteServers = async (
  deps: AppleDeps
): Promise<AnisetteServer[] | undefined> => {
  const { config } = deps
  try {
    const response = await fetchApple(deps, config.anisetteServerListUrl, {
      timeoutMs: config.timeouts.healthCheckMs
    })

    return httpsOnly(
      deps,
      serverListSchema.parse(JSON.parse(utf8Decode(response.body))).servers
    )
  } catch (error) {
    deps.logger.warn(
      'anisette server list unavailable; using the last known list',
      { cause: error }
    )
    return undefined
  }
}

const STORED_LIST_KEY = 'anisette/server-list'

const storedListSchema = z.object({
  fetchedAt: z.number(),
  servers: z.array(
    z.object({
      name: z.string(),
      address: z.string(),
      protocol: z.enum(['v1', 'v3']).optional()
    })
  )
})

const loadStoredList = async (
  deps: AppleDeps
): Promise<FetchedList | undefined> => {
  try {
    const raw = await deps.secrets.get(STORED_LIST_KEY)
    if (!raw) return undefined
    const parsed = storedListSchema.safeParse(JSON.parse(utf8Decode(raw)))

    if (!parsed.success) return undefined

    return {
      fetchedAt: parsed.data.fetchedAt,
      servers: parsed.data.servers.map((server) => compact(server))
    }
  } catch (error) {
    deps.logger.warn('saved anisette server list unreadable', { cause: error })
    return undefined
  }
}

export const createRemoteServerList = (deps: AppleDeps): RemoteServerList => {
  const { config, clock } = deps
  let known: FetchedList | undefined
  let loaded = false
  let failedAt: number | undefined
  let inFlight: Promise<AnisetteServer[]> | undefined

  const isFresh = (now: number): boolean =>
    known !== undefined &&
    now - known.fetchedAt < config.anisetteServerListMaxAgeMs

  const isRetryDue = (now: number): boolean =>
    failedAt === undefined || now - failedAt >= config.anisetteServerListRetryMs

  const refresh = async (): Promise<AnisetteServer[]> => {
    if (!loaded) {
      known = await loadStoredList(deps)
      loaded = true
    }
    const now = clock.now().getTime()
    if (isFresh(now) || !isRetryDue(now)) return known?.servers ?? []
    const servers = await fetchRemoteServers(deps)
    if (!servers) {
      failedAt = now
      return known?.servers ?? []
    }
    failedAt = undefined
    known = { servers, fetchedAt: now }
    await deps.secrets.set(STORED_LIST_KEY, utf8Encode(JSON.stringify(known)))
    deps.logger.debug('anisette server list updated', {
      servers: servers.length
    })

    return servers
  }

  return {
    current: () => {
      inFlight ??= refresh().finally(() => {
        inFlight = undefined
      })

      return inFlight
    }
  }
}
