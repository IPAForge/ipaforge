import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FirstFix } from '@ui/features/install/recovery/components/first-fix.tsx'
import { FixButton } from '@ui/features/install/recovery/components/fix-button.tsx'
import { ReportProblem } from '@ui/features/install/recovery/components/report-problem.tsx'
import { SwitchAccountDialog } from '@ui/features/install/recovery/components/switch-account-dialog.tsx'
import { useDiagnostics } from '@ui/features/install/recovery/hooks/use-diagnostics.ts'
import { useFixHandlers } from '@ui/features/install/recovery/hooks/use-fix-handlers.ts'
import { useRecoveryContext } from '@ui/features/install/recovery/hooks/use-recovery-context.ts'
import type { RecoveryBoxProps } from '@ui/features/install/recovery/types.ts'
import { recoveryFixes } from '@ui/features/install/recovery/utils/recovery-fixes.ts'
import { BackToInstall } from '@ui/features/install/run/components/back-to-install.tsx'
import { CopyDiagnostics } from '@ui/features/install/run/components/copy-diagnostics.tsx'
import { ShowLogs } from '@ui/features/install/run/components/show-logs.tsx'
import { stepLabel } from '@ui/features/install/run/utils/step-label.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { useSelection } from '@ui/hooks/use-selection.ts'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/**
 * A failed run: what went wrong, the fixes the Engine lists for its error (the first with what to do and its
 * button, the others as buttons), where the run continues from, Back to Install to choose again, diagnostics for a
 * report, and the run's lines in Logs. The error code itself is only in the diagnostics.
 */
export const RecoveryBox = ({ run, failure, target }: RecoveryBoxProps) => {
  const { t } = useTranslation()
  const engine = useEngine()
  const { restart } = useRun()
  const { select } = useSelection()
  const [isChoosingAccount, setChoosingAccount] = useState(false)
  const onChooseAccount = () => setChoosingAccount(true)
  const onCloseAccounts = () => setChoosingAccount(false)
  const onAccountChosen = (accountId: string) => {
    setChoosingAccount(false)
    select('account', accountId)
    restart({ accountId })
  }
  const handlers = useFixHandlers(run, onChooseAccount)
  const { labelValues, nextAppIdSlot } = useRecoveryContext(run)
  const { code } = failure.error
  const { first, others } = recoveryFixes(
    engine.classify(failure.error).recovery
  )
  const label = stepLabel(run, failure.stepId)
  const diagnostics = useDiagnostics(run, failure, target)

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl bg-danger-soft px-4 py-3"
    >
      <p className="font-semibold text-danger">{t(errorTitleKey(code))}</p>
      <p className="text-muted text-sm">{t(errorBodyKey(code))}</p>
      {first ? (
        <FirstFix
          action={first}
          handlers={handlers}
          isPending={handlers.isPairing}
          labelValues={labelValues}
          note={
            first === 'wait-for-app-id-slot' && nextAppIdSlot
              ? t('recovery.fix.waitForAppIdSlot.next', { date: nextAppIdSlot })
              : undefined
          }
        />
      ) : null}
      {others.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-muted text-sm">
          <span>{t('recovery.or')}</span>
          {others.map((action) => (
            <FixButton
              key={action}
              action={action}
              handlers={handlers}
              labelValues={labelValues}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-danger/20 border-t pt-2">
        {label && run.view.checkpoint ? (
          <p className="text-muted text-xs">
            {t('install.failed.continues', {
              step: t(label as TranslationKey)
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <BackToInstall />
          <CopyDiagnostics text={diagnostics} />
          <ShowLogs run={run} />
          <ReportProblem code={code} diagnostics={diagnostics} />
        </div>
      </div>
      {isChoosingAccount ? (
        <SwitchAccountDialog
          currentId={run.input.accountId}
          udid={run.input.udid}
          onChoose={onAccountChosen}
          onClose={onCloseAccounts}
        />
      ) : null}
    </div>
  )
}
