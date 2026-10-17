import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useStepDetail } from '@ui/features/install/run/use-step-detail.ts'
import type { TranslationKey } from '@ui/i18n/setup/i18next-types.ts'
import type { StepState, StepView } from '@ui/state/active-run/run-view.ts'

const icons = {
  pending: { icon: Circle, className: 'text-muted' },
  active: {
    icon: LoaderCircle,
    className: 'text-accent motion-safe:animate-spin'
  },
  waiting: { icon: CircleAlert, className: 'text-warning' },
  done: { icon: CircleCheck, className: 'text-success' },
  skipped: { icon: CircleDashed, className: 'text-muted' },
  failed: { icon: CircleX, className: 'text-danger' }
} as const satisfies Record<StepState, { icon: LucideIcon; className: string }>

const rowClasses = {
  pending: 'text-muted',
  active: 'bg-surface-secondary font-medium',
  waiting: 'bg-surface-secondary font-medium',
  done: '',
  skipped: 'text-muted',
  failed: 'font-medium text-danger'
} as const satisfies Record<StepState, string>

/** The state said in words where the icon alone would not say it. */
const stateKeys: Partial<Record<StepState, TranslationKey>> = {
  waiting: 'install.run.stepState.waiting',
  skipped: 'install.run.stepState.skipped',
  failed: 'install.run.stepState.failed'
}

/** One step: its icon, label (from the Engine's label key), state or percentage, and detail. */
export const StepRow = ({ step }: { step: StepView }) => {
  const { t } = useTranslation()
  const detail = useStepDetail(step.detail)
  const { icon: Icon, className } = icons[step.state]
  const stateKey = stateKeys[step.state]
  const percent =
    step.state === 'active' && step.fraction > 0 && !detail
      ? t('install.run.percent', { fraction: step.fraction })
      : undefined

  return (
    <li
      data-state={step.state}
      className={`grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 ${rowClasses[step.state]}`}
    >
      <Icon aria-hidden="true" className={`size-4 ${className}`} />
      <span>{t(step.labelKey as TranslationKey)}</span>
      <span className="font-normal text-muted text-xs tabular-nums">
        {stateKey ? t(stateKey) : (percent ?? null)}
      </span>
      {detail ? (
        <span className="col-start-2 col-end-4 font-normal text-muted text-xs">
          {detail}
        </span>
      ) : null}
    </li>
  )
}
