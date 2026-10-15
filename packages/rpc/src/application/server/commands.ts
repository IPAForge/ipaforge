// Starts the Engine command a request names, once its inputs are ready.
import type { CommandOptions, Engine, RunHandle } from '@loadstar/installer'
import { compact } from '@loadstar/kernel'
import { toInstallAppsInput } from '@rpc/application/server/inputs.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { CommandCall } from '@rpc/domain/protocol/requests.ts'

type Options = CommandOptions<unknown>

type CommandStarters = {
  readonly [C in CommandCall as C['command']]: (
    input: C['input'],
    options: Options,
    signal: AbortSignal
  ) => Promise<RunHandle<unknown>>
}

/** The checkpoint store pairs every checkpoint with the command that made it, so its state has that command's type. */
const typed = <S>(options: Options): CommandOptions<S> =>
  options as CommandOptions<S>

const commandStarters = (
  engine: Engine,
  resolveIpa: ResolveIpa
): CommandStarters => ({
  installSideStore: async (input, options) =>
    engine.installSideStore(compact(input), typed(options)),
  installApps: async (input, options, signal) =>
    engine.installApps(
      await toInstallAppsInput(input, resolveIpa, signal),
      typed(options)
    ),
  placePairing: async (input, options) =>
    engine.placePairing(compact(input), typed(options))
})

export type StartCommand = (
  call: CommandCall,
  options: Options,
  signal: AbortSignal
) => Promise<RunHandle<unknown>>

export const createCommandStarter = (
  engine: Engine,
  resolveIpa: ResolveIpa
): StartCommand => {
  const starters = commandStarters(engine, resolveIpa)

  // The union of starters cannot be called with the union of calls; `command` pairs them up.
  return (call, options, signal) =>
    (
      starters[call.command] as (
        input: CommandCall['input'],
        options: Options,
        signal: AbortSignal
      ) => Promise<RunHandle<unknown>>
    )(call.input, options, signal)
}
