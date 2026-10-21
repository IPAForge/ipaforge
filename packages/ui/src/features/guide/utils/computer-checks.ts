import type { TFunction } from 'i18next'

import { deviceServiceFixKeys } from '@ui/features/guide/constants.ts'
import type { CheckState, HostSystem } from '@ui/features/guide/types.ts'
import type { SystemCheck } from '@ui/services/engine/types.ts'

type ComputerCheck = {
  readonly id: 'service' | 'apple' | 'clock' | 'anisette'
  readonly title: string
  readonly state: CheckState
  readonly text: string
}

const MINUTE_S = 60

/** The four checks of This computer, as the step shows them: waiting while read, then fine or what to do. */
export const computerChecks = (
  t: TFunction,
  data: SystemCheck | undefined,
  system: HostSystem
): ComputerCheck[] => {
  const row = (
    id: ComputerCheck['id'],
    ok: boolean | undefined,
    okText: () => string,
    fixText: () => string
  ): ComputerCheck => {
    const title = t(`guide.computer.${id}.title`)
    if (ok === undefined)
      return { id, title, state: 'waiting', text: t('guide.checking') }

    return ok
      ? { id, title, state: 'ok', text: okText() }
      : { id, title, state: 'problem', text: fixText() }
  }

  return [
    row(
      'service',
      data && data.deviceService === 'ok',
      // Never shown: the step leaves the service out while it answers.
      () => '',
      () => t(deviceServiceFixKeys[system])
    ),
    row(
      'apple',
      data?.apple,
      () => t('guide.computer.apple.ok'),
      () => t('guide.computer.apple.fix')
    ),
    row(
      'clock',
      data?.clockOk,
      () => t('guide.computer.clock.ok'),
      () =>
        t('guide.computer.clock.fix', {
          minutes: Math.max(
            1,
            Math.round(Math.abs(data?.clockSkewSeconds ?? 0) / MINUTE_S)
          )
        })
    ),
    row(
      'anisette',
      data && data.anisette.server !== undefined,
      () =>
        t('guide.computer.anisette.ok', { name: data?.anisette.server ?? '' }),
      () =>
        t('guide.computer.anisette.fix', { tried: data?.anisette.tried ?? 0 })
    )
  ]
}
