import type { TFunction } from 'i18next'

import type { StepDetail as StepReport } from '@ipaforge/rpc'
import type { outcomeToneClasses } from '@ui/features/install/run/constants.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { DeviceCheck } from '@ui/services/engine/types.ts'
import type {
  ActiveRun,
  RunApp,
  RunKind,
  StepView
} from '@ui/state/active-run/types.ts'

export type RunTarget = {
  readonly kind: RunKind
  /** "SideStore", or the apps of an apps run as a list ("StikDebug and MyGame"). */
  readonly app: string
  /** How many apps the run installs. */
  readonly count: number
  /** SideStore's channel; an apps run has none. */
  readonly channel: string | undefined
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

/** The lines of a diagnostics text, already worded. */
export type DiagnosticsFacts = {
  readonly appVersion: string
  readonly code: string
  /** "Install on the device (install-0)". */
  readonly step: string
  /** "SideStore, Stable channel (sidestore, stable)". */
  readonly install: string
  /** "iPhone 17 (iPhone18,3), iOS 26.6.1". */
  readonly device: string
}

/** What turning a step's report into words needs: translation and number formatting. */
export type ReportWords = {
  readonly t: TFunction
  readonly fileSize: (bytes: number) => string
  readonly list: (items: readonly string[]) => string
  /** The app being installed ("SideStore"), for the release step. */
  readonly appName: string
}

/** One function per report kind, each given the report of its own kind. */
export type StepReportTexts = {
  readonly [K in StepReport['kind']]: (
    report: Extract<StepReport, { kind: K }>,
    words: ReportWords
  ) => string
}

/** An apps run's steps for one app, or the shared ones (no app). */
export type AppStepGroup = {
  readonly key: string
  readonly app?: RunApp | undefined
  readonly steps: readonly StepView[]
}
