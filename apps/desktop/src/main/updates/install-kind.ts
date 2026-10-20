// How this copy was installed, which decides whether it can update itself. macOS (dmg or zip), the NSIS installer
// and an AppImage can; the .msi, .deb and .rpm packages can't, so their users download the new version.
import { dirname, join } from 'node:path'

import { linuxPackages } from '@desktop/main/updates/constants.ts'
import type { InstallKind, InstallProbe } from '@desktop/main/updates/types.ts'

/** The NSIS installer leaves its uninstaller next to the app; the .msi doesn't. */
const windowsKind = (probe: InstallProbe): InstallKind =>
  probe.exists(
    join(dirname(probe.execPath), `Uninstall ${probe.productName}.exe`)
  )
    ? 'self'
    : 'msi'

const linuxKind = (probe: InstallProbe): InstallKind => {
  if (probe.appImage) return 'self'
  const packageType = probe
    .readText(join(probe.resourcesPath, 'package-type'))
    ?.trim()

  return (packageType && linuxPackages[packageType]) || 'other'
}

const kinds: Partial<
  Record<NodeJS.Platform, (probe: InstallProbe) => InstallKind>
> = {
  darwin: () => 'self',
  win32: windowsKind,
  linux: linuxKind
}

export const installKind = (probe: InstallProbe): InstallKind =>
  kinds[probe.platform]?.(probe) ?? 'other'
