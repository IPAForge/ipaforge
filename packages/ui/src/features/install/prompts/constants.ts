import type { ReactNode } from 'react'

import { PromptKind } from '@loadstar/rpc'
import { PasswordPrompt } from '@ui/components/prompts/password-prompt.tsx'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { TwoFactorCodePrompt } from '@ui/components/prompts/two-factor-code-prompt.tsx'
import { TwoFactorMethodPrompt } from '@ui/components/prompts/two-factor-method-prompt.tsx'

/** The questions this version asks, each with its dialog: the password and the second factor. */
export const askedPrompts: Partial<
  Record<PromptKind, (props: PromptProps<never>) => ReactNode>
> = {
  [PromptKind.Password]: PasswordPrompt,
  [PromptKind.TwoFactorMethod]: TwoFactorMethodPrompt,
  [PromptKind.TwoFactorCode]: TwoFactorCodePrompt
}

/**
 * A question this version can't ask yet (the team, a certificate to revoke, an app to remove): it says so and
 * offers to cancel, so the run never waits on a question nobody sees.
 */
export const questionKeys = {
  [PromptKind.ChooseTeam]: 'install.run.unsupportedPrompt.question.team',
  [PromptKind.RevokeCertificate]:
    'install.run.unsupportedPrompt.question.revokeCertificate',
  [PromptKind.ChooseAppToRemove]:
    'install.run.unsupportedPrompt.question.removeApp',
  [PromptKind.ShareCertificate]:
    'install.run.unsupportedPrompt.question.shareCertificate',
  [PromptKind.ChoosePairingApps]:
    'install.run.unsupportedPrompt.question.pairingApps'
} as const satisfies Partial<Record<PromptKind, string>>
