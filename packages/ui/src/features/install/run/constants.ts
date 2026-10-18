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
import type {
  RunKind,
  RunStatus,
  StepState
} from '@ui/state/active-run/types.ts'

/** The run's title for each kind of run and status. */
export const runTitleKeys = {
  sidestore: {
    starting: 'install.run.title.running',
    running: 'install.run.title.running',
    waiting: 'install.run.title.running',
    answering: 'install.run.title.running',
    completed: 'install.run.title.completed',
    failed: 'install.run.title.failed',
    cancelled: 'install.run.title.cancelled'
  },
  apps: {
    starting: 'preload.run.title.running',
    running: 'preload.run.title.running',
    waiting: 'preload.run.title.running',
    answering: 'preload.run.title.running',
    completed: 'preload.run.title.completed',
    failed: 'preload.run.title.failed',
    cancelled: 'install.run.title.cancelled'
  }
} as const satisfies Record<RunKind, Record<RunStatus, TranslationKey>>

/** The tints of an outcome box: the box itself and its title. */
export const outcomeToneClasses = {
  success: { box: 'bg-success-soft', title: 'text-success' },
  warning: { box: 'bg-warning-soft', title: 'text-warning-soft-foreground' },
  danger: { box: 'bg-danger-soft', title: 'text-danger-soft-foreground' }
} as const

export const stepIcons = {
  pending: { icon: Circle, className: 'text-muted' },
  active: {
    icon: LoaderCircle,
    className: 'text-accent motion-safe:animate-spin'
  },
  waiting: { icon: CircleAlert, className: 'text-warning-soft-foreground' },
  done: { icon: CircleCheck, className: 'text-success' },
  skipped: { icon: CircleDashed, className: 'text-muted' },
  failed: { icon: CircleX, className: 'text-danger-soft-foreground' }
} as const satisfies Record<StepState, { icon: LucideIcon; className: string }>

export const stepRowClasses = {
  pending: 'text-muted',
  active: 'bg-surface-secondary font-medium',
  waiting: 'bg-surface-secondary font-medium',
  done: '',
  skipped: 'text-muted',
  failed: 'font-medium text-danger-soft-foreground'
} as const satisfies Record<StepState, string>

/** The state said in words where the icon alone would not say it. */
export const stepStateKeys: Partial<Record<StepState, TranslationKey>> = {
  waiting: 'install.run.stepState.waiting',
  skipped: 'install.run.stepState.skipped',
  failed: 'install.run.stepState.failed'
}

/** How a group of an apps run's steps is going, in words and colour. */
export const groupStateText = {
  failed: {
    key: 'preload.run.group.failed',
    className: 'text-danger-soft-foreground'
  },
  done: { key: 'preload.run.group.done', className: 'text-success' },
  active: { key: 'preload.run.group.active', className: 'text-foreground' },
  pending: { key: 'preload.run.group.pending', className: 'text-muted' }
} as const satisfies Record<
  string,
  { readonly key: TranslationKey; readonly className: string }
>
