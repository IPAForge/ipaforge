// Opens the device and stops early on what would make every later step fail: a locked screen, Developer Mode
// off, or a computer the device does not trust (`device.not_paired` from opening it).
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { AccountState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import {
  assertCanRunSideloadedApps,
  type DeviceCheck,
  shortUdid
} from '@loadstar/device'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

const assertUnlocked = (check: DeviceCheck): void => {
  if (!check.locked) return
  throw new LoadstarError(ErrorCode.DeviceLocked, {
    data: { device: shortUdid(check.info.udid) }
  })
}

export const devicePreflightStep = <S extends AccountState>(
  runtime: FlowRuntime
): Step<S> => ({
  id: 'device',
  labelKey: StepLabel.device,
  weight: StepWeight.check,
  idempotent: true,
  run: async (state) => {
    const check = await (await runtime.device(state.udid)).check()
    assertUnlocked(check)
    assertCanRunSideloadedApps(check)
    const { name, productVersion, deviceClass } = check.info

    return {
      device: {
        udid: state.udid,
        name,
        iosVersion: productVersion,
        deviceClass
      }
    } as Partial<S>
  }
})
