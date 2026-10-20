// The remote community list of anisette servers (SideStore's), which the anisette service tries after the servers
// the user added and before its own built-in backup. The remote list is kept up to date: fetched again once it is older than its maximum age
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
): { servers: AnisetteServer[]; skipped: string[] } => {
  const secure = servers.filter((server) =>
    server.address.startsWith('https://')
  )
  const skipped = servers
    .filter((server) => !secure.includes(server))
    .map((server) => server.name)
  if (skipped.length > 0)
    deps.logger.warn(
      'ignoring non-HTTPS anisette servers from the remote list',
      { servers: skipped }
    )

  return { servers: secure, skipped }
}

/** The remote list's HTTPS servers and the names left out, or undefined when it cannot be fetched. */
const fetchRemoteServers = async (
  deps: AppleDeps
): Promise<{ servers: AnisetteServer[]; skipped: string[] } | undefined> => {
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
  skipped: z.array(z.string()).optional(),
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
      servers: parsed.data.servers.map((server) => compact(server)),
      skipped: parsed.data.skipped ?? []
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

  const loadOnce = async () => {
    if (loaded) return
    known = await loadStoredList(deps)
    loaded = true
  }

  const refresh = async (force: boolean): Promise<AnisetteServer[]> => {
    await loadOnce()
    const now = clock.now().getTime()
    if (!force && (isFresh(now) || !isRetryDue(now)))
      return known?.servers ?? []
    const fetched = await fetchRemoteServers(deps)
    if (!fetched) {
      failedAt = now
      return known?.servers ?? []
    }
    failedAt = undefined
    known = { ...fetched, fetchedAt: now }
    await deps.secrets.set(STORED_LIST_KEY, utf8Encode(JSON.stringify(known)))
    deps.logger.debug('anisette server list updated', {
      servers: fetched.servers.length
    })

    return fetched.servers
  }

  const run = (force: boolean): Promise<AnisetteServer[]> => {
    // A forced update waits for a fetch already going, then fetches itself.
    const previous = inFlight ?? Promise.resolve([])
    const next = force
      ? previous.then(
          () => refresh(true),
          () => refresh(true)
        )
      : (inFlight ?? refresh(false))
    const tracked = next.finally(() => {
      if (inFlight === tracked) inFlight = undefined
    })
    inFlight = tracked

    return tracked
  }

  return {
    current: () => run(false),
    snapshot: async () => {
      await loadOnce()
      return known
    },
    update: async () => {
      await run(true)
      return known
    }
  }
}
