// Maintainer tool: exercises @ipaforge/apple against Apple with real accounts. Run it in your own terminal:
//
//   pnpm --filter @ipaforge/desktop apple-probe preflight   # Apple reachable? clock right? anisette servers healthy?
//   pnpm --filter @ipaforge/desktop apple-probe anisette    # which server works (header names only, never values)
//   pnpm --filter @ipaforge/desktop apple-probe developer   # interactive sign-in, then READ-ONLY: teams, devices,
//                                                           # certificates (who made them), App IDs and quota
//   pnpm --filter @ipaforge/desktop apple-probe signin      # sign in one or more Apple IDs (2FA, app token), saved
//   pnpm --filter @ipaforge/desktop apple-probe accounts    # check every saved account's session
//   pnpm --filter @ipaforge/desktop apple-probe forget      # delete saved accounts, sessions and passwords
//
// Saved between runs (so you do not sign in every time):
// - the anisette (machine) identity: ~/.ipaforge/dev/anisette.json (0600);
// - accounts and sessions, and a password only if you agree: ~/.ipaforge/dev/secrets.enc, AES-256-GCM encrypted
//   with a key in your macOS login keychain ("dev.ipaforge.probe"). Elsewhere: kept in memory only.
// `apple-probe forget` deletes the saved accounts.
// Passwords are read without echo and never printed or logged; tokens and keys are never printed.
// The commands live in src/probes/apple/.
import { appleCommands } from '@desktop/probes/apple/commands/index.ts'
import { createAppleProbe } from '@desktop/probes/apple/context.ts'
import { describeError } from '@desktop/probes/apple/describe-error.ts'
import { selectCommand } from '@desktop/probes/shared/commands.ts'

const probe = createAppleProbe()
const run = selectCommand(appleCommands(probe), process.argv[2] ?? 'signin')
try {
  await run()
} catch (error) {
  console.error(`✗ ${describeError(error)}`)
  process.exitCode = 1
} finally {
  probe.prompt.close()
}
