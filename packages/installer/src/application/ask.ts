import type { PromptKind } from '@installer/domain/prompts.ts'
import type { PromptAnswer, PromptData } from '@installer/domain/types.ts'
import type { StepContext } from '@installer/pipeline/types.ts'

/** Asks the user a typed question (see `Prompts`). */
export const ask = <K extends PromptKind>(
  context: StepContext,
  kind: K,
  data: PromptData<K>
): Promise<PromptAnswer<K>> =>
  context.prompt<PromptAnswer<K>>({
    kind,
    data: data as Readonly<Record<string, unknown>>
  })
