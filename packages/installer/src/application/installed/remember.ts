// After an app is installed: remember it and keep its original IPA, so it can be refreshed later. A refresh keeps
// the IPA it was signed from (the same file), and the record keeps where the app first came from.
import { originOf } from '@installer/application/installed/marker.ts'
import {
  keptKeyFor,
  saveRecord
} from '@installer/application/installed/records.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { InstallState } from '@installer/domain/types.ts'
import { jobAt, required } from '@installer/steps/app-job.ts'
import { compact } from '@ipaforge/kernel'

export const rememberInstalled = async (
  runtime: FlowRuntime,
  state: InstallState,
  index: number
): Promise<void> => {
  const { deps } = runtime
  const job = jobAt(state, index)
  const identity = required(job.identity, 'identity plan')
  const inspection = required(job.inspection, 'inspection')
  const file = required(job.file, 'IPA file')
  const bundleId = identity.newMainBundleId
  const keptKey = keptKeyFor(state.udid, bundleId)

  try {
    // A refresh signs the kept IPA itself; it's already where it belongs.
    if (job.source.kind !== 'installed')
      await deps.kept.put(keptKey, file.stream())
    await saveRecord(
      deps,
      compact({
        udid: state.udid,
        bundleId,
        originalBundleId: inspection.app.identifier,
        name: inspection.app.name,
        version: inspection.app.version,
        origin: originOf(job),
        trust: job.trust,
        installedAt: deps.clock.now().toISOString(),
        keptKey
      })
    )
  } catch (error) {
    // The app is installed; only Refresh from IPAForge won't be possible.
    deps.logger.warn('could not remember the installed app', {
      bundleId,
      cause: error
    })
  }
}
