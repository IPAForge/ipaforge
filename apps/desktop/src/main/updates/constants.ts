import type { ManualFile } from '@desktop/main/updates/types.ts'
import type { ManualPackage } from '@ipaforge/rpc'

/** IPAForge's releases on GitHub: each one's page, and its files under `download/`. */
export const RELEASES_URL = 'https://github.com/SirReaDy/ipaforge/releases'

/** How long the check may take before IPAForge opens without it (offline, a slow network). */
export const CHECK_TIMEOUT_MS = 15_000

/** How long "Installing" shows before IPAForge quits to install. */
export const INSTALL_DELAY_MS = 1500

/** The Linux packages that name themselves in `resources/package-type` (electron-builder writes it). */
export const linuxPackages: Readonly<Record<string, ManualPackage>> = {
  deb: 'deb',
  rpm: 'rpm'
}

/** The release file for each package that can't update itself, named like electron-builder names it per CPU. */
export const manualFiles: Readonly<Partial<Record<ManualPackage, ManualFile>>> =
  {
    // One x64 installer, which also runs on Windows on Arm.
    msi: { os: 'win', arch: { x64: 'x64', arm64: 'x64' }, extension: 'msi' },
    deb: {
      os: 'linux',
      arch: { x64: 'amd64', arm64: 'arm64' },
      extension: 'deb'
    },
    rpm: {
      os: 'linux',
      arch: { x64: 'x86_64', arm64: 'aarch64' },
      extension: 'rpm'
    }
  }
