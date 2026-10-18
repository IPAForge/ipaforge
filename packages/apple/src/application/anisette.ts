// Anisette with automatic failover: users never have to pick a server. Servers come from the remote list (plus a
// built-in fallback and any custom server); the last server that worked is tried first; each server keeps its own
// provisioning state; a server that says "not provisioned" is re-provisioned once.

import { fromV1, fromV3 } from '@apple/application/anisette/providers.ts'
import {
  createRemoteServerList,
  dedupe
} from '@apple/application/anisette/server-list.ts'
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
  const remoteList = createRemoteServerList(deps)

  const servers = async (): Promise<AnisetteServer[]> =>
    dedupe([
      ...(options.custom ? [options.custom] : []),
      ...config.fallbackAnisetteServers,
      ...(await remoteList.current())
    ])

  const health = async (server: AnisetteServer): Promise<ServerHealth> => {
    const started = deps.clock.now().getTime()
    try {
      if (server.protocol === 'v1')
        await fetchV1(deps, server, config.timeouts.healthCheckMs)
      else await fetchClientInfo(deps, server, config.timeouts.healthCheckMs)
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
    const all = await servers()
    const lastGood = await states.lastGood()
    const ordered = dedupe([
      ...(getOptions.preferred ? [getOptions.preferred] : []),
      ...all.filter((server) => server.address === lastGood),
      ...all
    ])
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
    throw new IPAForgeError(ErrorCode.AnisetteUnavailable, {
      message: `no anisette server worked (${failures.length} tried)`,
      data: { tried: failures }
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

  return { servers, health, get, resync, reset }
}
