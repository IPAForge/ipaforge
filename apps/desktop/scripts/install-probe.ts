// Maintainer tool: runs the real install flows (the Engine) against a real iPhone/iPad and a real Apple account.
// Sign in first with `apple-probe signin`; pair the device with `device-probe pair`. Run it in your own terminal:
//
//   pnpm --filter @loadstar/desktop install-probe plan <file.ipa|catalogAppId> [--account <id>] [--team <id>] [--udid <udid>]
//       READ-ONLY: the IPA inspection, the new identity, the App ID budget, free-app slots and certificate status
//   pnpm --filter @loadstar/desktop install-probe sidestore [--channel stable|nightly] [--livecontainer]
//       [--account <id>] [--team <id>] [--udid <udid>] --yes
//   pnpm --filter @loadstar/desktop install-probe ipa <file.ipa…> [--account <id>] [--team <id>] [--udid <udid>] --yes
//   pnpm --filter @loadstar/desktop install-probe pairing [--keep-existing] [--account <id>] [--udid <udid>] --yes
//
// The write commands create App IDs, certificates and profiles on Apple's side and install on the device, so they
// refuse to run without --yes. Prompts (password, 2FA code, team, certificate to revoke, app to remove, sharing the
// certificate with an imported IPA, pairing apps) are answered here; an empty answer cancels.
//
// Saved between runs (shared with apple-probe):
// - the anisette (machine) identity: ~/.loadstar/dev/anisette.json (0600);
// - accounts, sessions, and each team's certificate with its private key: ~/.loadstar/dev/secrets.enc, AES-256-GCM
//   encrypted with a key in your macOS login keychain ("dev.loadstar.probe"). Elsewhere: kept in memory only;
// - downloaded IPAs: ~/.loadstar/dev/downloads; signed IPAs wait in ~/.loadstar/dev/scratch until installed.
// UDIDs are shortened unless --show-udid is given. Passwords, tokens and keys are never printed.
// The commands live in src/probes/install/.

import { describeError } from "@desktop/probes/apple/describe-error.ts";
import { parseInstallProbeArgs } from "@desktop/probes/install/args.ts";
import { INSTALL_COMMANDS } from "@desktop/probes/install/commands/index.ts";
import { createInstallProbe } from "@desktop/probes/install/context.ts";
import { LoadstarError } from "@loadstar/kernel";

const USAGE = `usage: install-probe <command> [options]
  plan <file.ipa|catalogAppId>   read-only preview (identity, App ID budget, free-app slots, certificate)
  sidestore --yes                install SideStore (--livecontainer, --channel stable|nightly)
  ipa <file.ipa…> --yes          install IPAs
  pairing --yes                  place this computer's pairing file into pairing apps (--keep-existing)
common: --account <id> --team <id> --udid <udid> --show-udid`;

const args = parseInstallProbeArgs(process.argv.slice(2));
const command = INSTALL_COMMANDS[args.command];
if (!command) {
  if (args.command) console.error(`unknown command "${args.command}"`);
  console.error(USAGE);
  process.exit(2);
}
const probe = createInstallProbe(args);
try {
  await command(probe)();
} catch (error) {
  console.error(`✗ ${describeError(error)}`);
  // Usage mistakes are plain errors; anything from the Engine gets the diagnosis the UI would show.
  if (error instanceof LoadstarError) {
    const { code, recovery } = probe.engine.classify(error);
    console.error(`  diagnosis: ${code}; recovery: ${recovery.join(", ")}`);
  }
  process.exitCode = 1;
} finally {
  probe.prompt.close();
}
