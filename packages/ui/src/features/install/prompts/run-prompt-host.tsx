import { useTranslation } from 'react-i18next'

import { PromptKind, type PromptRequest } from '@loadstar/rpc'
import { PasswordPrompt } from '@ui/components/prompts/password-prompt.tsx'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { TwoFactorCodePrompt } from '@ui/components/prompts/two-factor-code-prompt.tsx'
import { TwoFactorMethodPrompt } from '@ui/components/prompts/two-factor-method-prompt.tsx'
import { useRun } from '@ui/hooks/use-run.ts'

type Actions = {
  onAnswer: (answer: unknown) => void
  onDecline: () => void
  declineLabelKey: 'install.run.cancelInstall'
}

/**
 * A question this version can't ask yet (the team, a certificate to revoke, an app to remove): it says so and
 * offers to cancel, so the run never waits on a question nobody sees.
 */
const questionKeys = {
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

const questionKey = (kind: string) =>
  kind in questionKeys
    ? questionKeys[kind as keyof typeof questionKeys]
    : 'install.run.unsupportedPrompt.question.other'

const NotYetAsked = ({
  kind,
  onDecline,
  declineLabelKey
}: Actions & { kind: string }) => {
  const { t } = useTranslation()

  return (
    <PromptShell
      title={t('install.run.unsupportedPrompt.title')}
      description={t('install.run.unsupportedPrompt.body', {
        question: t(questionKey(kind))
      })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
    />
  )
}

const PromptFor = ({
  request,
  ...actions
}: Actions & { request: PromptRequest }) => {
  switch (request.kind) {
    case PromptKind.Password:
      return (
        <PasswordPrompt
          data={request.data as PromptProps<'apple.password'>['data']}
          {...actions}
        />
      )
    case PromptKind.TwoFactorMethod:
      return (
        <TwoFactorMethodPrompt
          data={request.data as PromptProps<'apple.two_factor_method'>['data']}
          {...actions}
        />
      )
    case PromptKind.TwoFactorCode:
      return (
        <TwoFactorCodePrompt
          data={request.data as PromptProps<'apple.two_factor_code'>['data']}
          {...actions}
        />
      )
    default:
      return <NotYetAsked kind={request.kind} {...actions} />
  }
}

/**
 * The install run's questions, as dialogs over whatever section is open: the password and the second factor.
 * Mounted once, by the shell; nothing shows while no question waits.
 */
export const RunPromptHost = () => {
  const { run, answer, decline } = useRun()
  const request = run?.view.status === 'waiting' ? run.view.prompt : undefined
  if (!request) return null

  return (
    <PromptFor
      key={run?.view.promptCount}
      request={request}
      onAnswer={answer}
      onDecline={decline}
      declineLabelKey="install.run.cancelInstall"
    />
  )
}
