import type { PromptRequest } from '@ipaforge/rpc'
import { NotYetAsked } from '@ui/features/install/prompts/components/not-yet-asked.tsx'
import type { RunPromptActions } from '@ui/features/install/prompts/types.ts'
import { askedPrompt } from '@ui/features/install/prompts/utils/asked-prompt.ts'

type PromptForProps = RunPromptActions & {
  request: PromptRequest
  /** The answer went to the Engine and it hasn't moved on yet. */
  isPending: boolean
}

/** The dialog for one question; a question this version doesn't know offers to cancel. */
export const PromptFor = ({
  request,
  isPending,
  ...actions
}: PromptForProps) => {
  const Prompt = askedPrompt(request.kind)
  if (!Prompt) return <NotYetAsked {...actions} />

  return (
    <Prompt data={request.data as never} isPending={isPending} {...actions} />
  )
}
