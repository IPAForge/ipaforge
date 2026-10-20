// Anisette with automatic failover, or the one server the user chose. Automatic tries the servers the user added,
// then the last server that worked, then SideStore's list, then IPAForge's built-in backup, moving on when one
// fails. Each server keeps its own provisioning state; a server that says "not provisioned" is re-provisioned once.

import {
  addServer,
  choose,
  overview,
  removeServer,
  type ServerCatalog,
  serverEntries,
  serverToTest,
  updateServer
} from '@apple/application/anisette/manage-servers.ts'
import { fromV1, fromV3 } from '@apple/application/anisette/providers.ts'
import {
  createRemoteServerList,
  dedupe
} from '@apple/application/anisette/server-list.ts'
import { createAnisetteSettingsStore } from '@apple/application/anisette/settings-store.ts'
import { createAnisetteStateStore } from '@apple/application/anisette/state-store.ts'
import type { AnisetteService, ServerHealth } from '@apple/application/types.ts'
import type { AnisetteData, AnisetteServer } from '@apple/domain/types.ts'
import { errorMessage } from '@apple/domain/values.ts'
import { fetchV1 } from '@apple/infrastructure/anisette/v1.ts'
import {
  completeHeaders,
  fetchClientInfo,
  getHeadersV3
} from '@apple/infrastructure/anisette/v3.ts'
import type { AppleDeps } from '@apple/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const createAnisetteService = (
  deps: AppleDeps,
  options: { custom?: AnisetteServer } = {}
): AnisetteService => {
  const { logger, config } = deps
  const states = createAnisetteStateStore(deps.secrets)
  const settings = createAnisetteSettingsStore(deps.secrets, logger)
  const catalog: ServerCatalog = {
    deps,
    settings,
    remoteList: createRemoteServerList(deps),
    ...(options.custom ? { configured: options.custom } : {})
  }

  const servers = async (): Promise<AnisetteServer[]> =>
    (await serverEntries(catalog, await settings.load())).map(
      ({ name, address, protocol }) =>
        protocol ? { name, address, protocol } : { name, address }
    )

  /** The servers to try, in order: the chosen one alone, or Automatic's order. */
  const candidates = async (
    preferred: AnisetteServer | undefined
  ): Promise<AnisetteServer[]> => {
    const { choice, custom } = await settings.load()
    const chosen = choice.mode === 'chosen' ? choice.server : undefined
    if (chosen) {
      const listed = (await servers()).find(
        (server) => dedupe([server, chosen]).length === 1
      )

      return [listed ?? chosen]
    }
    const all = await servers()
    const lastGood = await states.lastGood()

    return dedupe([
      ...(preferred ? [preferred] : []),
      ...custom,
      ...all.filter((server) => server.address === lastGood),
      ...all
    ])
  }

  const health = async (server: AnisetteServer): Promise<ServerHealth> => {
    const started = deps.clock.now().getTime()
    try {
      // One request each: a health check reports what the server says, without retrying.
      if (server.protocol === 'v1')
        await fetchV1(deps, server, config.timeouts.healthCheckMs, false)
      else
        await fetchClientInfo(
          deps,
          server,
          config.timeouts.healthCheckMs,
          false
        )
      return {
        server,
        ok: true,
        latencyMs: deps.clock.now().getTime() - started
      }
    } catch (error) {
      return { server, ok: false, error: errorMessage(error) }
    }
  }

  const fromServer = (
    server: AnisetteServer,
    signal?: AbortSignal
  ): Promise<AnisetteData> =>
    server.protocol === 'v1'
      ? fromV1(deps, server)
      : fromV3(deps, states, server, signal)

  const get: AnisetteService['get'] = async (getOptions = {}) => {
    const ordered = await candidates(getOptions.preferred)
    const lastGood = await states.lastGood()
    const failures: { server: string; error: string }[] = []
    for (const server of ordered) {
      getOptions.signal?.throwIfAborted()
      try {
        const data = await fromServer(server, getOptions.signal)
        if (lastGood !== server.address)
          await states.setLastGood(server.address)
        logger.debug('anisette ready', { server: server.name })
        return data
      } catch (error) {
        const message = errorMessage(error)
        failures.push({ server: server.name, error: message })
        logger.warn('anisette server failed; trying the next one', {
          server: server.name,
          error: message
        })
      }
    }
    const { choice } = await settings.load()
    throw new IPAForgeError(ErrorCode.AnisetteUnavailable, {
      message: `no anisette server worked (${failures.length} tried)`,
      data:
        choice.mode === 'chosen' && choice.server
          ? { tried: failures, chosen: choice.server.name }
          : { tried: failures }
    })
  }

  const resync = async (
    data: AnisetteData,
    resyncData: string
  ): Promise<AnisetteData> => {
    const server = (await servers()).find(
      (candidate) => candidate.address === data.serverAddress
    ) ?? {
      name: data.server,
      address: data.serverAddress
    }
    if (server.protocol === 'v1') {
      throw new IPAForgeError(ErrorCode.AnisetteUnavailable, {
        message: 'this anisette server cannot resync'
      })
    }
    const state = await states.load(server)
    if (!state?.adiPb)
      throw new IPAForgeError(ErrorCode.AnisetteNotProvisioned, {
        data: { server: server.name }
      })
    const result = await getHeadersV3(
      deps,
      server,
      state.identifier,
      state.adiPb,
      resyncData
    )
    if (result.kind !== 'headers') {
      throw new IPAForgeError(ErrorCode.AnisetteNotProvisioned, {
        message: result.message,
        data: { server: server.name }
      })
    }
    logger.info('anisette resynced', { server: server.name })
    return {
      ...data,
      headers: await completeHeaders(deps, state.identifier, result.headers)
    }
  }

  const reset = async (server?: AnisetteServer): Promise<void> => {
    const targets = server ? [server] : await servers()
    for (const target of targets) await states.forget(target)
    if (!server) await states.forgetLastGood()
  }

  const show = async () => overview(catalog, await states.lastGood())

  return {
    servers,
    health,
    get,
    resync,
    reset,
    overview: show,
    choose: async (choice) => {
      await choose(catalog, choice)
      return show()
    },
    addServer: async (input) => {
      await addServer(catalog, input)
      return show()
    },
    updateServer: async (address, input) => {
      await updateServer(catalog, address, input)
      return show()
    },
    removeServer: async (address) => {
      await states.forget(await removeServer(catalog, address))
      return show()
    },
    test: async (address) => {
      const result = await health(await serverToTest(catalog, address))
      logger.info('anisette server tested', {
        server: result.server.name,
        ok: result.ok,
        ...(result.error ? { error: result.error } : {})
      })
      return result.latencyMs === undefined
        ? { address: result.server.address, ok: result.ok }
        : {
            address: result.server.address,
            ok: result.ok,
            latencyMs: result.latencyMs
          }
    },
    updateList: async () => {
      await catalog.remoteList.update()
      return show()
    }
  }
}
