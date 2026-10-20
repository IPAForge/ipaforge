import { manualFiles, RELEASES_URL } from '@desktop/main/updates/constants.ts'
import type { InstallKind } from '@desktop/main/updates/types.ts'
import type { UpdateState } from '@ipaforge/rpc'

/** A release's page on GitHub. */
export const releasePage = (version: string): string =>
  `${RELEASES_URL}/tag/v${version}`

/** The update a package that can't update itself shows: its file for this system when known, else the release. */
export const manualUpdate = (
  version: string,
  kind: Exclude<InstallKind, 'self'>,
  arch: string
): UpdateState => {
  const file = manualFiles[kind]
  const fileArch = file?.arch[arch]
  if (!file || !fileArch)
    return {
      phase: 'manual',
      version,
      packageType: kind,
      url: releasePage(version)
    }
  const fileName = `IPAForge-${version}-${file.os}-${fileArch}.${file.extension}`

  return {
    phase: 'manual',
    version,
    packageType: kind,
    fileName,
    url: `${RELEASES_URL}/download/v${version}/${fileName}`
  }
}
