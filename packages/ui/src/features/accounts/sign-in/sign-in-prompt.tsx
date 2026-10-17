import { useEffect } from 'react'

import { PromptKind, type PromptRequest } from '@loadstar/rpc'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { TwoFactorCodePrompt } from '@ui/components/prompts/two-factor-code-prompt.tsx'
import { TwoFactorMethodPrompt } from '@ui/components/prompts/two-factor-method-prompt.tsx'

type SignInPromptProps = {
  request: PromptRequest
  onAnswer: (answer: unknown) => void
  onDecline: () => void
  isPending: boolean
}

type DeclineProps = { onDecline: () => void }

/** Declines a question sign-in does not ask, so the run ends instead of waiting forever. */
const Decline = ({ onDecline }: DeclineProps) => {
  useEffect(() => onDecline(), [onDecline])
  return null
}

/** The questions a sign-in asks after the password: where to send the code, then the code. */
export const SignInPrompt = ({
  request,
  onAnswer,
  onDecline,
  isPending
}: SignInPromptProps) => {
  const actions = {
    onAnswer,
    onDecline,
    isPending,
    declineLabelKey: 'prompts.cancel'
  } as const
  if (request.kind === PromptKind.TwoFactorMethod)
    return (
      <TwoFactorMethodPrompt
        data={request.data as PromptProps<'apple.two_factor_method'>['data']}
        {...actions}
      />
    )
  if (request.kind === PromptKind.TwoFactorCode)
    return (
      <TwoFactorCodePrompt
        data={request.data as PromptProps<'apple.two_factor_code'>['data']}
        {...actions}
      />
    )
  return <Decline onDecline={onDecline} />
}
