// Before signing in: can we reach Apple and an anisette server, and is the computer's clock right? Each problem
// gets its own error code instead of a generic "login failed".

import type {
  AnisetteService,
  AppleProbe,
  PreflightReport
} from '@apple/application/types.ts'
import { errorMessage, nonEmpty } from '@apple/domain/values.ts'
import { fetchApple } from '@apple/infrastructure/http.ts'
import type { AppleDeps } from '@apple/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** How many anisette servers to probe (they are probed in parallel). */
const ANISETTE_PROBES = 3
const HTTP_SERVER_ERROR = 500

/** Whether Apple answers at all (any status below 500), and how far its clock is from ours. */
const probeApple = (deps: AppleDeps): Promise<AppleProbe> =>
  fetchApple(deps, deps.config.endpoints.gsaLookup, {
    timeoutMs: deps.config.timeouts.healthCheckMs,
    retryTransient: false,
    acceptStatus: () => true
  }).then(
    (result) => ({
      ok: result.status < HTTP_SERVER_ERROR,
      skewMs: result.clockSkewMs
    }),
    (error: unknown) => ({ ok: false, error: errorMessage(error) })
  )

const firstProblem = (
  appleOk: boolean,
  clockOk: boolean,
  anisetteOk: boolean
): ErrorCode | undefined => {
  if (!appleOk) return ErrorCode.Offline
  if (!clockOk) return ErrorCode.ClockSkew
  if (!anisetteOk) return ErrorCode.AnisetteUnavailable
  return undefined
}

export const runPreflight = async (
  deps: AppleDeps,
  anisette: AnisetteService
): Promise<PreflightReport> => {
  const servers = (await anisette.servers()).slice(0, ANISETTE_PROBES)
  const [apple, health] = await Promise.all([
    probeApple(deps),
    Promise.all(servers.map((server) => anisette.health(server)))
  ])
  const { skewMs } = apple
  const clockOk =
    skewMs === undefined || Math.abs(skewMs) <= deps.config.maxClockSkewMs

  return compact({
    apple: compact({ ok: apple.ok, error: nonEmpty(apple.error) }),
    clockSkewSeconds:
      skewMs === undefined ? undefined : Math.round(skewMs / 1000),
    clockOk,
    anisette: health,
    problem: firstProblem(
      apple.ok,
      clockOk,
      health.some((server) => server.ok)
    )
  })
}

/** Throws the report's problem, if any. */
export const assertPreflight = (report: PreflightReport): void => {
  if (!report.problem) return
  throw new IPAForgeError(report.problem, {
    data: compact({
      skewSeconds: report.clockSkewSeconds,
      anisette: report.anisette.map((server) => ({
        name: server.server.name,
        ok: server.ok
      }))
    })
  })
}
