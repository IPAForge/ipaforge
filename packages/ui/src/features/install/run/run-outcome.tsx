import { Button } from '@heroui/react'
import { ClipboardCopy } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { RunTarget } from '@ui/features/install/run/use-run-target.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/i18next-types.ts'
import type { ActiveRun } from '@ui/state/active-run/active-run-store.ts'
import type { RunFailure } from '@ui/state/active-run/run-view.ts'

type OutcomeProps = { run: ActiveRun; target: RunTarget }

const toneClasses = {
  success: { box: 'bg-success-soft', title: 'text-success' },
  warning: { box: 'bg-warning-soft', title: 'text-warning' },
  danger: { box: 'bg-danger-soft', title: 'text-danger' }
} as const

/** A tinted box like the device notices: the title in its tone, the text, and its buttons under it. */
const OutcomeBox = ({
  tone,
  title,
  children,
  actions
}: {
  tone: keyof typeof toneClasses
  title: ReactNode
  children: ReactNode
  actions: ReactNode
}) => (
  <div
    role="status"
    className={`flex flex-col gap-1 rounded-xl px-4 py-3 ${toneClasses[tone].box}`}
  >
    <p className={`font-semibold ${toneClasses[tone].title}`}>{title}</p>
    <div className="text-muted text-sm">{children}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>
  </div>
)

const RunningActions = ({ run }: { run: ActiveRun }) => {
  const { t } = useTranslation()
  const { cancel } = useRun()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onPress={cancel}>
        {t('install.run.cancel')}
      </Button>
      <span className="text-muted text-sm">
        {t(
          run.view.status === 'waiting'
            ? 'install.run.waitingHint'
            : 'install.run.runningHint'
        )}
      </span>
    </div>
  )
}

const stepLabel = (run: ActiveRun, stepId: string) =>
  run.view.steps.find((step) => step.id === stepId)?.labelKey

const Cancelled = ({ run }: { run: ActiveRun }) => {
  const { t } = useTranslation()
  const { resume, dismiss } = useRun()
  const next = run.view.steps.find((step) => step.state === 'pending')

  return (
    <OutcomeBox
      tone="warning"
      title={
        next
          ? t('install.cancelled.title', {
              step: t(next.labelKey as TranslationKey)
            })
          : t('install.run.title.cancelled')
      }
      actions={
        <>
          <Button onPress={resume}>{t('install.cancelled.resume')}</Button>
          <Button variant="secondary" onPress={dismiss}>
            {t('install.cancelled.close')}
          </Button>
        </>
      }
    >
      {t('install.cancelled.body')}
    </OutcomeBox>
  )
}

const Done = ({ target }: { target: RunTarget }) => {
  const { t } = useTranslation()
  const { dismiss } = useRun()

  return (
    <OutcomeBox
      tone="success"
      title={t('install.done.title', {
        app: target.app,
        device: target.deviceName
      })}
      actions={<Button onPress={dismiss}>{t('install.done.done')}</Button>}
    >
      <ol className="list-decimal ps-5">
        <li>{t('install.done.trust', { appleId: target.appleId })}</li>
        <li>{t('install.done.open')}</li>
      </ol>
    </OutcomeBox>
  )
}

/** What failed and on what, never a secret; for a bug report, so it stays in English. */
const diagnosticsText = (
  appVersion: string,
  run: ActiveRun,
  failure: RunFailure,
  target: RunTarget
) =>
  [
    'Loadstar diagnostics',
    `version: ${appVersion}`,
    `code: ${failure.error.code}`,
    `step: ${failure.stepId || 'unknown'}`,
    `install: ${run.input.variant} (${run.input.channel ?? 'stable'})`,
    `device: ${target.check?.info.productType ?? 'unknown'}, iOS ${target.check?.info.productVersion ?? 'unknown'}`
  ].join('\n')

const CopyDiagnostics = ({ text }: { text: string }) => {
  const { t } = useTranslation()
  const { clipboard, logger } = useUiServices()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const onCopy = () =>
    clipboard.writeText(text).then(
      () => setState('copied'),
      () => {
        logger.warn('could not copy the diagnostics')
        setState('failed')
      }
    )

  return (
    <>
      <Button variant="tertiary" onPress={onCopy}>
        <ClipboardCopy aria-hidden="true" className="size-4" />
        {t('install.failed.copy')}
      </Button>
      {state === 'idle' ? null : (
        <span role="status" className="text-sm">
          {t(
            state === 'copied'
              ? 'install.failed.copied'
              : 'install.failed.copyFailed'
          )}
        </span>
      )}
    </>
  )
}

/** A failed run: what went wrong in the words for its code, Try again from where it stopped, and diagnostics. */
const Failed = ({
  run,
  failure,
  target
}: OutcomeProps & { failure: RunFailure }) => {
  const { t } = useTranslation()
  const { appVersion } = useUiServices()
  const { resume, restart } = useRun()
  const label = stepLabel(run, failure.stepId)
  const onTryAgain = () => (run.view.checkpoint ? resume() : restart({}))

  return (
    <OutcomeBox
      tone="danger"
      title={t(errorTitleKey(failure.error.code))}
      actions={
        <>
          <Button onPress={onTryAgain}>{t('install.failed.tryAgain')}</Button>
          <CopyDiagnostics
            text={diagnosticsText(appVersion, run, failure, target)}
          />
        </>
      }
    >
      <p>{t(errorBodyKey(failure.error.code))}</p>
      {label && run.view.checkpoint ? (
        <p className="mt-1 text-xs">
          {t('install.failed.continues', {
            step: t(label as TranslationKey)
          })}
        </p>
      ) : null}
    </OutcomeBox>
  )
}

/** Over the steps: Cancel while it runs, Resume when stopped, what to do on the device when done, the failure. */
export const RunOutcome = ({ run, target }: OutcomeProps) => {
  const { status, failure } = run.view
  if (status === 'completed') return <Done target={target} />
  if (status === 'cancelled') return <Cancelled run={run} />
  if (status === 'failed' && failure)
    return <Failed run={run} failure={failure} target={target} />
  return <RunningActions run={run} />
}
