import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  type LucideIcon
} from 'lucide-react'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { RunStatus, StepState } from '@ui/state/active-run/types.ts'

/** The run's title for each status. */
export const runTitleKeys = {
  starting: 'install.run.title.running',
  running: 'install.run.title.running',
  waiting: 'install.run.title.running',
  completed: 'install.run.title.completed',
  failed: 'install.run.title.failed',
  cancelled: 'install.run.title.cancelled'
} as const satisfies Record<RunStatus, TranslationKey>

/** The tints of an outcome box: the box itself and its title. */
export const outcomeToneClasses = {
  success: { box: 'bg-success-soft', title: 'text-success' },
  warning: { box: 'bg-warning-soft', title: 'text-warning' },
  danger: { box: 'bg-danger-soft', title: 'text-danger' }
} as const

export const stepIcons = {
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

export const stepRowClasses = {
  pending: 'text-muted',
  active: 'bg-surface-secondary font-medium',
  waiting: 'bg-surface-secondary font-medium',
  done: '',
  skipped: 'text-muted',
  failed: 'font-medium text-danger'
} as const satisfies Record<StepState, string>

/** The state said in words where the icon alone would not say it. */
export const stepStateKeys: Partial<Record<StepState, TranslationKey>> = {
  waiting: 'install.run.stepState.waiting',
  skipped: 'install.run.stepState.skipped',
  failed: 'install.run.stepState.failed'
}
