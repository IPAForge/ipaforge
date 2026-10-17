// The Engine facade: every capability the UI can call. Commands start a flow and return a run handle; queries
// read; `classify` turns any failure into a catalogued code with its recovery actions.
import {
  createDeviceWatch,
  type DeviceWatchListener
} from '@installer/application/device-watch.ts'
import {
  type InstallerDepsInput,
  resolveInstallerDeps
} from '@installer/deps.ts'
import { classify, type Diagnosis } from '@installer/diagnostics/classify.ts'
import type { InstallState } from '@installer/domain/state.ts'
import {
  createEngineQueries,
  type EngineQueries
} from '@installer/engine/queries.ts'
import {
  type CommandOptions,
  type RunHandle,
  startRun
} from '@installer/engine/run-handle.ts'
import {
  type InstallAppsInput,
  installAppsFlow
} from '@installer/flows/install-apps.ts'
import {
  type InstallSideStoreInput,
  installSideStoreFlow
} from '@installer/flows/install-sidestore.ts'
import {
  type PairingState,
  type PlacePairingInput,
  placePairingFlow
} from '@installer/flows/place-pairing.ts'
import {
  type SignInFlowInput,
  type SignInState,
  signInFlow
} from '@installer/flows/sign-in.ts'

export type Engine = EngineQueries & {
  installSideStore(
    input: InstallSideStoreInput,
    options?: CommandOptions<InstallState>
  ): RunHandle<InstallState>
  installApps(
    input: InstallAppsInput,
    options?: CommandOptions<InstallState>
  ): RunHandle<InstallState>
  placePairing(
    input: PlacePairingInput,
    options?: CommandOptions<PairingState>
  ): RunHandle<PairingState>
  /** Adds an Apple ID: asks for its password (and a second factor) through prompts, then saves it. */
  signIn(
    input: SignInFlowInput,
    options?: CommandOptions<SignInState>
  ): RunHandle<SignInState>
  /**
   * Connected devices as they come and go (usbmuxd `Listen`): the full list first, then each attach and detach
   * with the list after it. Returns the function that stops listening; aborting `signal` stops it too.
   */
  watchDevices(
    listener: DeviceWatchListener,
    options?: { readonly signal?: AbortSignal }
  ): () => void
  /**
   * Forgets a saved Apple ID: the account, its session and its saved password. Its signing certificates stay in
   * the secret store, so signing in again reuses them instead of using up the team's certificate slots.
   */
  signOut(accountId: string): Promise<void>
  classify(error: unknown): Diagnosis
}

export const createEngine = (input: InstallerDepsInput): Engine => {
  const deps = resolveInstallerDeps(input)
  const deviceWatch = createDeviceWatch(deps)

  return {
    ...createEngineQueries(deps),
    installSideStore: (command, options) =>
      startRun(
        deps,
        (runtime) => installSideStoreFlow(runtime, command),
        options
      ),
    installApps: (command, options) =>
      startRun(deps, (runtime) => installAppsFlow(runtime, command), options),
    placePairing: (command, options) =>
      startRun(deps, (runtime) => placePairingFlow(runtime, command), options),
    signIn: (command, options) =>
      startRun(deps, (runtime) => signInFlow(runtime, command), options),
    signOut: async (accountId) => {
      await deps.apple.accounts.remove(accountId)
      deps.logger.info('signed out', { account: accountId })
    },
    watchDevices: (listener, options) =>
      deviceWatch.subscribe(listener, options?.signal),
    classify
  }
}
