import { afcCheckCommand } from '@desktop/probes/device/commands/afc-check.ts'
import { afcSpeedCommand } from '@desktop/probes/device/commands/afc-speed.ts'
import {
  tvBrowseCommand,
  tvPairCommand
} from '@desktop/probes/device/commands/code-pairing.ts'
import {
  appsCommand,
  infoCommand,
  listCommand,
  pairCommand,
  profilesCommand,
  revealDevModeCommand,
  wifiListCommand
} from '@desktop/probes/device/commands/device.ts'
import { installCommand } from '@desktop/probes/device/commands/install.ts'
import {
  pairingStatusCommand,
  placeCommand,
  targetsCommand
} from '@desktop/probes/device/commands/pairing-file.ts'
import { remotePairCommand } from '@desktop/probes/device/commands/remote-pairing.ts'
import {
  rsdServicesCommand,
  tunnelInstallCommand
} from '@desktop/probes/device/commands/tunnel.ts'
import { wifiTunnelCommand } from '@desktop/probes/device/commands/wifi-tunnel.ts'
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import type { ProbeCommands } from '@desktop/probes/shared/types.ts'

export const deviceCommands = (probe: DeviceProbe): ProbeCommands => ({
  list: listCommand(probe),
  info: infoCommand(probe),
  pair: pairCommand(probe),
  apps: appsCommand(probe),
  profiles: profilesCommand(probe),
  install: installCommand(probe),
  targets: targetsCommand(probe),
  'pairing-status': pairingStatusCommand(probe),
  'afc-check': afcCheckCommand(probe),
  'afc-speed': afcSpeedCommand(probe),
  place: placeCommand(probe),
  'reveal-devmode': revealDevModeCommand(probe),
  'rp-pair': remotePairCommand(probe),
  'wifi-list': wifiListCommand(probe),
  'rsd-services': rsdServicesCommand(probe),
  'tunnel-install': tunnelInstallCommand(probe),
  'rp-tunnel': wifiTunnelCommand(probe),
  'tv-browse': tvBrowseCommand(probe),
  'tv-pair': tvPairCommand(probe)
})
