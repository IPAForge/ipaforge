import type { PromptData, PromptKind } from '@loadstar/rpc'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** What every question dialog gets: its data, and how to answer or decline it through the run handle. */
export type PromptProps<K extends PromptKind> = {
  data: PromptData<K>
  onAnswer: (answer: unknown) => void
  onDecline: () => void
  declineLabelKey: TranslationKey
  /**
   * The answer went to the Engine and it has not moved on yet (Apple is checking a code): the dialog stays, its
   * controls are read-only and the chosen action shows it is busy.
   */
  isPending?: boolean | undefined
}
