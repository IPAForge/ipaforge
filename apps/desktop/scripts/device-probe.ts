// Maintainer tool: exercises @ipaforge/device against a real iPhone/iPad through the system usbmuxd.
//
//   pnpm --filter @ipaforge/desktop device-probe list
//   pnpm --filter @ipaforge/desktop device-probe info            [--udid <udid>]
//   pnpm --filter @ipaforge/desktop device-probe pair            [--udid <udid>] [--own]
//   pnpm --filter @ipaforge/desktop device-probe apps            [--udid <udid>]
//   pnpm --filter @ipaforge/desktop device-probe profiles        [--udid <udid>]
//   pnpm --filter @ipaforge/desktop device-probe install <ipa>   [--udid <udid>]   (the IPA must already be signed)
//   pnpm --filter @ipaforge/desktop device-probe targets <TEAMID...>
//   pnpm --filter @ipaforge/desktop device-probe pairing-status <TEAMID...>   (which pairing files exist, read-only)
//   pnpm --filter @ipaforge/desktop device-probe place <TEAMID...> --yes [--only-missing]   (writes this Mac's pairing file)
//   pnpm --filter @ipaforge/desktop device-probe afc-check   (writes, reads back and deletes a file in PublicStaging)
//   pnpm --filter @ipaforge/desktop device-probe afc-speed [--mb 32]   (times AFC writes with each chunk size)
//   pnpm --filter @ipaforge/desktop device-probe reveal-devmode
//   pnpm --filter @ipaforge/desktop device-probe rp-pair   (iOS 17.4+: makes a remote pairing, then verifies it)
//   pnpm --filter @ipaforge/desktop device-probe wifi-list [--udid <udid>]   (finds known devices on Wi-Fi, no usbmuxd)
//   pnpm --filter @ipaforge/desktop device-probe rsd-services   (iOS 17.4+: the device's services inside its tunnel)
//   pnpm --filter @ipaforge/desktop device-probe tunnel-install [<signed.ipa>] [--mb 100] [--compare]
//     (iOS 17.4+: a timed upload, and an install, with every service through the tunnel; --compare: and classic)
//
// --direct (any device command): reach the device straight over Wi-Fi only, skipping the cable and usbmuxd. The
// devices to look for are usbmuxd's and --udid; their pair records come from usbmuxd.
// --tunnel (any device command): open every service through the iOS 17.4+ device tunnel when it has one there.
//
// `pair` (and any command on a device without a pair record) waits for the OS to pair: unlock the device and tap
// Trust, and the OS stores its record in usbmuxd. If none appears within the timeout, or with --own, IPAForge pairs
// with its own record instead, kept in this run's in-memory secret store only; usbmuxd is never written. When the
// device rejects the OS's record, the error says to unplug, plug back in, unlock and tap Trust.
//
// UDIDs are shortened in output unless --show-udid is given. LOG_LEVEL=debug shows protocol traffic (redacted).
// The commands live in src/probes/device/.

import { parseDeviceProbeArgs } from '@desktop/probes/device/args.ts'
import { deviceCommands } from '@desktop/probes/device/commands/index.ts'
import { createDeviceProbe } from '@desktop/probes/device/context.ts'
import { selectCommand } from '@desktop/probes/shared/commands.ts'
import { causeChain } from '@desktop/probes/shared/errors.ts'
import { IPAForgeError } from '@ipaforge/kernel'

const args = parseDeviceProbeArgs(process.argv.slice(2))
const run = selectCommand(deviceCommands(createDeviceProbe(args)), args.command)
try {
  await run()
} catch (error) {
  if (error instanceof IPAForgeError)
    console.error(`${error.code}: ${error.message}`, error.data ?? '')
  else console.error(error)
  for (const line of causeChain(error)) console.error(line)
  process.exit(1)
}
