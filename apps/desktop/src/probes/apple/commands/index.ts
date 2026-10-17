import {
  accountsCommand,
  forgetCommand,
  signInCommand
} from '@desktop/probes/apple/commands/accounts.ts'
import { developerCommand } from '@desktop/probes/apple/commands/developer.ts'
import {
  anisetteCommand,
  preflightCommand
} from '@desktop/probes/apple/commands/diagnostics.ts'
import type { AppleProbe } from '@desktop/probes/apple/context.ts'
import type { ProbeCommands } from '@desktop/probes/shared/types.ts'

export const appleCommands = (probe: AppleProbe): ProbeCommands => ({
  developer: developerCommand(probe),
  preflight: preflightCommand(probe),
  anisette: anisetteCommand(probe),
  signin: signInCommand(probe),
  accounts: accountsCommand(probe),
  forget: forgetCommand(probe)
})
