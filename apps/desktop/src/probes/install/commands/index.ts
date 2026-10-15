import {
  ipaCommand,
  pairingCommand,
  sideStoreCommand
} from '@desktop/probes/install/commands/install.ts'
import { planCommand } from '@desktop/probes/install/commands/plan.ts'
import type { InstallProbe } from '@desktop/probes/install/context.ts'
import type { ProbeCommand } from '@desktop/probes/shared/commands.ts'

/** By name; a command is built only once it is known, so a typo never opens the secret store. */
export const INSTALL_COMMANDS: Readonly<
  Record<string, (probe: InstallProbe) => ProbeCommand>
> = {
  plan: planCommand,
  sidestore: sideStoreCommand,
  ipa: ipaCommand,
  pairing: pairingCommand
}
