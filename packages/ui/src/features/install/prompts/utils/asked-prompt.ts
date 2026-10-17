import type { PromptKind } from '@loadstar/rpc'
import { askedPrompts } from '@ui/features/install/prompts/asked-prompts.ts'

/** The dialog for a question; undefined for one this version doesn't know (from a newer Engine). */
export const askedPrompt = (kind: string) =>
  Object.hasOwn(askedPrompts, kind)
    ? askedPrompts[kind as PromptKind]
    : undefined
