import { compact } from '@ipaforge/kernel'
import type { EngineClient, RemoteCommandOptions } from '@ipaforge/rpc'
import type { InstallRun } from '@ui/services/engine/types.ts'
import type {
  RestartPatch,
  RunKind,
  RunRequest
} from '@ui/state/active-run/types.ts'

type Launcher = (
  engine: EngineClient,
  request: never,
  options: RemoteCommandOptions
) => InstallRun

/** The Engine command each kind of run is. Both return the same handle (the install state over the wire). */
export const runLaunchers = {
  sidestore: (
    engine,
    request: Extract<RunRequest, { kind: 'sidestore' }>,
    options
  ) => engine.installSideStore(request.input, options),
  apps: (engine, request: Extract<RunRequest, { kind: 'apps' }>, options) =>
    engine.installApps(request.input, options)
} satisfies Record<RunKind, Launcher>

export const launchRun = (
  engine: EngineClient,
  request: RunRequest,
  options: RemoteCommandOptions
): InstallRun =>
  (runLaunchers[request.kind] as (...args: Parameters<Launcher>) => InstallRun)(
    engine,
    request as never,
    options
  )

/** The same request started again with another Apple ID, or (SideStore only) the other channel. */
export const patchedRequest = (
  request: RunRequest,
  { accountId, channel }: RestartPatch
): RunRequest =>
  request.kind === 'sidestore'
    ? {
        ...request,
        input: { ...request.input, ...compact({ accountId, channel }) }
      }
    : {
        ...request,
        input: { ...request.input, ...compact({ accountId }) }
      }

/** What the log says about a run that starts: what it installs, never who or where. */
export const runLogFields = (request: RunRequest) =>
  request.kind === 'sidestore'
    ? { kind: request.kind, variant: request.input.variant }
    : { kind: request.kind, apps: request.apps.length }
