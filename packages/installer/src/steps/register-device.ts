import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import type { AccountState } from '@installer/domain/state.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { Step } from '@installer/pipeline/step.ts'
import { required } from '@installer/steps/app-job.ts'

/** Registers the device with the team unless it already is (safe to repeat, so it is retried like a read). */
export const registerDeviceStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'register-device',
  labelKey: StepLabel.registerDevice,
  weight: StepWeight.appleRequest,
  idempotent: true,
  run: async (state) => {
    const developer = await runtime.developer(state.accountId)
    const device = required(state.device, 'device')
    await developer.registerDevice(
      required(state.team, 'team'),
      device.udid,
      device.name
    )
    return undefined
  }
})
