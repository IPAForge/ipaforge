// What Refresh installs: the app's kept IPA with its record, as an install source. An app the Engine didn't install,
// or whose IPA is gone, can't be refreshed here.
import {
  keptKeyFor,
  readRecords
} from '@installer/application/installed/records.ts'
import type { AppSource } from '@installer/domain/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const installedSource = async (
  deps: InstallerDeps,
  udid: string,
  bundleId: string
): Promise<AppSource> => {
  const record = (await readRecords(deps, udid)).find(
    (known) => known.bundleId === bundleId
  )
  const file = await deps.kept.get(
    record?.keptKey ?? keptKeyFor(udid, bundleId)
  )

  if (!(record && file))
    throw new IPAForgeError(ErrorCode.KeptIpaMissing, {
      message: 'no kept IPA for this app',
      data: { bundleId }
    })

  return { kind: 'installed', file, record }
}
