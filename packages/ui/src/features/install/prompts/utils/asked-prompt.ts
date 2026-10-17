import type { PromptKind } from '@loadstar/rpc'
import { askedPrompts } from '@ui/features/install/prompts/constants.ts'

/** The dialog for a question this version asks; undefined for one it can't ask yet. */
export const askedPrompt = (kind: string) =>
  Object.hasOwn(askedPrompts, kind)
    ? askedPrompts[kind as PromptKind]
    : undefined
