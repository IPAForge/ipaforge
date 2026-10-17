import type { PromptRequest } from '@loadstar/rpc'
import { NotYetAsked } from '@ui/features/install/prompts/components/not-yet-asked.tsx'
import type { RunPromptActions } from '@ui/features/install/prompts/types.ts'
import { askedPrompt } from '@ui/features/install/prompts/utils/asked-prompt.ts'

type PromptForProps = RunPromptActions & { request: PromptRequest }

/** The dialog for one question: its own when this version asks it, otherwise one that offers to cancel. */
export const PromptFor = ({ request, ...actions }: PromptForProps) => {
  const Prompt = askedPrompt(request.kind)
  if (!Prompt) return <NotYetAsked kind={request.kind} {...actions} />

  return <Prompt data={request.data as never} {...actions} />
}
