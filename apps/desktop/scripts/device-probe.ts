// Maintainer tool: exercises @loadstar/device against a real iPhone/iPad through the system usbmuxd.
//
//   pnpm --filter @loadstar/desktop device-probe list
//   pnpm --filter @loadstar/desktop device-probe info            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe pair            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe apps            [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe profiles        [--udid <udid>]
//   pnpm --filter @loadstar/desktop device-probe install <ipa>   [--udid <udid>]   (the IPA must already be signed)
//   pnpm --filter @loadstar/desktop device-probe targets <TEAMID...>
//   pnpm --filter @loadstar/desktop device-probe pairing-status <TEAMID...>   (which pairing files exist, read-only)
//   pnpm --filter @loadstar/desktop device-probe place <TEAMID...> --yes [--only-missing]   (writes this Mac's pairing file)
//   pnpm --filter @loadstar/desktop device-probe afc-check   (writes, reads back and deletes a file in PublicStaging)
//   pnpm --filter @loadstar/desktop device-probe reveal-devmode
//
// UDIDs are shortened in output unless --show-udid is given. LOG_LEVEL=debug shows protocol traffic (redacted).
// The commands live in src/probes/device/.

import { parseDeviceProbeArgs } from "@desktop/probes/device/args.ts";
import { deviceCommands } from "@desktop/probes/device/commands/index.ts";
import { createDeviceProbe } from "@desktop/probes/device/context.ts";
import { selectCommand } from "@desktop/probes/shared/commands.ts";
import { LoadstarError } from "@loadstar/kernel";

const args = parseDeviceProbeArgs(process.argv.slice(2));
const run = selectCommand(deviceCommands(createDeviceProbe(args)), args.command);
try {
  await run();
} catch (error) {
  if (error instanceof LoadstarError) console.error(`${error.code}: ${error.message}`, error.data ?? "");
  else console.error(error);
  process.exit(1);
}
