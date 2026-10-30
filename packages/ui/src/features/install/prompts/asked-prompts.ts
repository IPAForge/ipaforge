// Every question the Engine asks, with its dialog. A module of its own (not constants.ts) because it imports the
// dialogs, and they import the feature's constants.
import type { ReactNode } from 'react'

import { PromptKind } from '@ipaforge/rpc'
import { PairingCodePrompt } from '@ui/components/prompts/pairing-code-prompt.tsx'
import { PasswordPrompt } from '@ui/components/prompts/password-prompt.tsx'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { TwoFactorCodePrompt } from '@ui/components/prompts/two-factor-code-prompt.tsx'
import { TwoFactorMethodPrompt } from '@ui/components/prompts/two-factor-method-prompt.tsx'
import { PairingAppsPrompt } from '@ui/features/install/prompts/components/pairing-apps-prompt.tsx'
import { RemoveAppPrompt } from '@ui/features/install/prompts/components/remove-app-prompt.tsx'
import { RevokeCertificatePrompt } from '@ui/features/install/prompts/components/revoke-certificate-prompt.tsx'
import { ShareCertificatePrompt } from '@ui/features/install/prompts/components/share-certificate-prompt.tsx'
import { TeamPrompt } from '@ui/features/install/prompts/components/team-prompt.tsx'

/** Every question the Engine asks, with its dialog. */
export const askedPrompts = {
  [PromptKind.Password]: PasswordPrompt,
  [PromptKind.TwoFactorMethod]: TwoFactorMethodPrompt,
  [PromptKind.TwoFactorCode]: TwoFactorCodePrompt,
  [PromptKind.ChooseTeam]: TeamPrompt,
  [PromptKind.RevokeCertificate]: RevokeCertificatePrompt,
  [PromptKind.ChooseAppToRemove]: RemoveAppPrompt,
  [PromptKind.ShareCertificate]: ShareCertificatePrompt,
  [PromptKind.ChoosePairingApps]: PairingAppsPrompt,
  [PromptKind.PairingCode]: PairingCodePrompt
} satisfies Record<PromptKind, (props: PromptProps<never>) => ReactNode>
