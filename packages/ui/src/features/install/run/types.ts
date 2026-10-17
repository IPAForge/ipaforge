import type { outcomeToneClasses } from '@ui/features/install/run/constants.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { DeviceCheck } from '@ui/services/engine/types.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

export type RunTarget = {
  readonly app: string
  readonly channel: string
  readonly deviceName: string
  readonly check?: DeviceCheck | undefined
  readonly appleId: string
}

/** What every outcome of a run is shown from. */
export type OutcomeProps = { run: ActiveRun; target: RunTarget }

export type OutcomeTone = keyof typeof outcomeToneClasses

/** One fact in the run's summary strip. */
export type SummaryItem = {
  readonly labelKey: TranslationKey
  readonly value: string
}
