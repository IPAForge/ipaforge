import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** How a check came out: fine, worth a look, a problem, something IPAForge can't see, or not in yet. */
export type CheckState = 'ok' | 'warn' | 'bad' | 'unknown' | 'checking'

/** One line of the checks, in words. */
export type CheckRow = {
  readonly id: string
  readonly state: CheckState
  readonly titleKey: TranslationKey
  readonly detailKey: TranslationKey
  readonly tagKey: TranslationKey
  readonly values?: Readonly<Record<string, string | number>>
}

/** A fix Repair can run. */
export type Fix = 'reinstall' | 'profile' | 'pairing'

/**
 * What Repair would do: the fixes the problems need, the ones offered for what's only a warning or can't be told,
 * and whether it can't install SideStore again with this Apple ID's team (another team or Apple ID signed it).
 */
export type RepairPlan = {
  readonly required: readonly Fix[]
  readonly optional: readonly Fix[]
  /** A fix was left out because another team or Apple ID signed SideStore. */
  readonly blocked: boolean
}

/** What the checks say before any fix: SideStore isn't there, the device needs a hand, or here's the plan. */
export type RepairStage = 'not-installed' | 'device' | 'fine' | 'plan'
