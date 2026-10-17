import { PromptFor } from '@ui/features/install/prompts/components/prompt-for.tsx'
import { useRun } from '@ui/hooks/use-run.ts'

/**
 * The install run's questions, as dialogs over whatever section is open. A question stays on screen, busy, after
 * it is answered until the Engine moves on. Mounted once, by the shell; nothing shows while no question waits.
 */
export const RunPromptHost = () => {
  const { run, answer, decline } = useRun()
  const status = run?.view.status
  const request =
    status === 'waiting' || status === 'answering'
      ? run?.view.prompt
      : undefined
  if (!request) return null

  return (
    <PromptFor
      key={run?.view.promptCount}
      request={request}
      isPending={status === 'answering'}
      onAnswer={answer}
      onDecline={decline}
      declineLabelKey="install.run.cancelInstall"
    />
  )
}
