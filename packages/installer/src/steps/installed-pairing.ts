// Gives the app just installed this computer's pairing file, at the paths its pairing-app entry lists (for
// LiveContainer, inside the SideStore it hosts).
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { appStepId, jobAt, required } from '@installer/steps/app-job.ts'
import { type AppFileTarget, PAIRING_APPS } from '@ipaforge/device'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const pairingTargetsFor = (
  appId: string,
  bundleId: string
): AppFileTarget[] => {
  const app = PAIRING_APPS.find((candidate) => candidate.id === appId)
  if (!app)
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: `unknown pairing app ${appId}`
    })
  return app.files.map((path) => ({ bundleId, path }))
}

/**
 * SideStore's own flow: the one app, its pairing-app entry from the run's state. An apps run passes `target`, one
 * step per SideStore in its list (`pairing-<index>`), so each gets the file.
 */
export const installedPairingStep = (
  runtime: FlowRuntime,
  target?: { readonly index: number; readonly pairingApp: string }
): Step<InstallState> => ({
  id: target ? appStepId('pairing', target.index) : 'pairing',
  labelKey: StepLabel.pairing,
  weight: StepWeight.pairing,
  skip: (state) => (target?.pairingApp ?? state.pairingApp) === undefined,
  run: async (state, context) => {
    const job = jobAt(state, target?.index ?? 0)
    const bundleId = required(job.identity, 'identity plan').newMainBundleId
    const targets = pairingTargetsFor(
      required(target?.pairingApp ?? state.pairingApp, 'pairing app'),
      bundleId
    )
    const handle = await runtime.device(state.udid)
    const { classic, remote } = await handle.placePairingFile(targets)
    const apps = [job.inspection?.app.name ?? bundleId]
    context.detail(
      remote.length > 0
        ? { kind: 'pairing', apps, remote: true }
        : { kind: 'pairing', apps }
    )

    return { pairingPlaced: [...classic, ...remote] }
  }
})
