import type { RecoveryAction } from '@loadstar/rpc'
import type { OutcomeProps } from '@ui/features/install/run/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { RunFailure } from '@ui/state/active-run/types.ts'

/**
 * What pressing a fix does: continue from the checkpoint, ask the device to trust this computer first, start
 * again with another Apple ID or the other channel, nothing (it only explains), or not shown yet (its screen
 * comes in a later phase).
 */
export type FixKind =
  | 'resume'
  | 'pair'
  | 'account'
  | 'channel'
  | 'info'
  | 'later'

/** One fix: what it does, what to tell the user, and its button when it is the first fix. */
export type Fix = {
  readonly kind: FixKind
  /** What to do, in a sentence. */
  readonly howKey?: TranslationKey
  /** What to do, step by step (instead of, or after, `howKey`). */
  readonly stepKeys?: readonly TranslationKey[]
  /** An Apple page to open, shown with a Copy button. */
  readonly link?: string
  /** The first fix's button; the action's own label otherwise. */
  readonly buttonKey?: TranslationKey
}

/** The fixes for a failure: the first one with its guidance, the others as buttons. */
export type RecoveryFixes = {
  readonly first: RecoveryAction | undefined
  readonly others: readonly RecoveryAction[]
}

/** Runs a fix of each kind that can be pressed. */
export type FixHandlers = Readonly<
  Record<Exclude<FixKind, 'info' | 'later'>, () => void>
>

/** The recovery box: the failed run, what failed, and what it installs where. */
export type RecoveryBoxProps = OutcomeProps & { failure: RunFailure }

/** What the fixes say about this failure in particular. */
export type RecoveryContext = {
  /** For button labels: the channel "use the other channel" starts again on. */
  readonly labelValues: FixLabelValues
  /** When the next App ID frees, formatted; undefined when the plan doesn't say. */
  readonly nextAppIdSlot: string | undefined
}

/** Values a fix's button label may name. */
export type FixLabelValues = {
  readonly channel: string
}
