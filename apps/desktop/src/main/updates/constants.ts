import type { ManualFile } from '@desktop/main/updates/types.ts'
import type { ManualPackage } from '@ipaforge/rpc'

/** IPAForge's releases on GitHub: each one's page, and its files under `download/`. */
export const RELEASES_URL = 'https://github.com/IPAForge/ipaforge/releases'

/**
 * Who signs IPAForge's releases: its release workflow (`release.yml` on a tag), through GitHub's OIDC issuer. The
 * repository moved from SirReaDy/ipaforge to the IPAForge organization; releases made before the move carry the
 * old name, so both are accepted, and nothing else.
 */
export const RELEASE_WORKFLOWS = [
  'https://github.com/IPAForge/ipaforge/.github/workflows/release.yml',
  'https://github.com/SirReaDy/ipaforge/.github/workflows/release.yml'
] as const

/** What sigstore-js says when a signature is valid but made by someone else. */
export const UNTRUSTED_SIGNER = 'UNTRUSTED_SIGNER_ERROR'
export const SIGSTORE_ISSUER = 'https://token.actions.githubusercontent.com'

/** Where an Intel build running under Rosetta sends the user for the Apple silicon one. */
export const NATIVE_BUILD_URL = `${RELEASES_URL}/latest`

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
