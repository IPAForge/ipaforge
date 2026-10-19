import { useTranslation } from 'react-i18next'

import { StepLive } from '@ui/features/install/run/components/step-live.tsx'
import {
  stepIcons,
  stepRowClasses,
  stepStateKeys
} from '@ui/features/install/run/constants.ts'
import { useStepDetail } from '@ui/features/install/run/hooks/use-step-detail.ts'
import { useStepReport } from '@ui/features/install/run/hooks/use-step-report.ts'
import { liveProgress } from '@ui/features/install/run/utils/live-progress.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { StepView } from '@ui/state/active-run/types.ts'

type StepRowProps = {
  step: StepView
  /** The app being installed, for the release step's words. */
  appName: string
}

/**
 * One step: its icon, label (from the Engine's label key), state or percentage, and what it is doing or did. While a
 * transfer or iOS's install runs, a bar with its numbers (bytes, speed, time left) instead.
 */
export const StepRow = ({ step, appName }: StepRowProps) => {
  const { t } = useTranslation()
  const progress = useStepDetail(step.detail)
  const report = useStepReport(step, appName)
  const live = step.state === 'active' ? liveProgress(step.detail) : undefined
  const label = t(step.labelKey as TranslationKey)
  // While the step runs, how far it is (MB downloaded, a retry); once it's done, what it did.
  const detail =
    step.state === 'active' && progress ? progress : (report ?? progress)
  const { icon: Icon, className } = stepIcons[step.state]
  const stateKey = stepStateKeys[step.state]
  const percent =
    step.state === 'active' && step.fraction > 0 && !detail && !live
      ? t('install.run.percent', { fraction: step.fraction })
      : undefined

  return (
    <li
      data-state={step.state}
      className={`grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 ${stepRowClasses[step.state]}`}
    >
      <Icon aria-hidden="true" className={`size-4 ${className}`} />
      <span>{label}</span>
      <span className="font-normal text-muted text-xs tabular-nums">
        {stateKey ? t(stateKey) : (percent ?? null)}
      </span>
      {live ? <StepLive progress={live} label={label} /> : null}
      {detail && !live ? (
        <span className="col-start-2 col-end-4 font-normal text-muted text-xs">
          {detail}
        </span>
      ) : null}
    </li>
  )
}
