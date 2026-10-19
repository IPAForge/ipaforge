// Repair SideStore: this computer's pairing file in the installed SideStore's Documents, replacing what's there.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { PAIRING_APPS } from '@ipaforge/device'

const SIDESTORE_APP_ID = 'sidestore'

export const sideStorePairingStep = (
  runtime: FlowRuntime,
  bundleId: string
): Step<InstallState> => ({
  id: 'pairing',
  labelKey: StepLabel.pairing,
  weight: StepWeight.pairing,
  run: async (state, context) => {
    const files =
      PAIRING_APPS.find((app) => app.id === SIDESTORE_APP_ID)?.files ?? []
    const handle = await runtime.device(state.udid)
    const pairingPlaced = await handle.placePairingFile(
      files.map((path) => ({ bundleId, path }))
    )

    context.detail({ kind: 'pairing', apps: ['SideStore'] })

    return { pairingPlaced }
  }
})
