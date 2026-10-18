import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { AccountState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { required } from '@installer/steps/app-job.ts'

/**
 * Registers the device with the team unless it is listed already (safe to repeat, so it is retried like a read),
 * and says which it was.
 */
export const registerDeviceStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'register-device',
  labelKey: StepLabel.registerDevice,
  weight: StepWeight.appleRequest,
  idempotent: true,
  run: async (state, context) => {
    const developer = await runtime.developer(state.accountId)
    const device = required(state.device, 'device')
    const team = required(state.team, 'team')
    const udid = device.udid.toLowerCase()
    const listed = (await developer.devices(team)).some(
      (registered) => registered.udid.toLowerCase() === udid
    )
    if (!listed) await developer.registerDevice(team, device.udid, device.name)
    context.detail({ kind: 'device-registration', isNew: !listed })
    return undefined
  }
})
