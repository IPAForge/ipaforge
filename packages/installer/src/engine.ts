// The Engine facade: every capability the UI can call. Commands start a flow and return a run handle; queries
// read; `classify` turns any failure into a catalogued code with its recovery actions.
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
  classify(error: unknown): Diagnosis
}

export const createEngine = (input: InstallerDepsInput): Engine => {
  const deps = resolveInstallerDeps(input)

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
    classify
  }
}
