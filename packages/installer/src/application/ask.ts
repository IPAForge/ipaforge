import type {
  PromptAnswer,
  PromptData,
  PromptKind
} from '@installer/domain/prompts.ts'
import type { StepContext } from '@installer/pipeline/step.ts'

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
