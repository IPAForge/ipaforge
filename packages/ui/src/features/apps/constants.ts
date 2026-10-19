import type { AppRunState, ExpiryTone } from '@ui/features/apps/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** The dot's colour for each expiry tone. */
export const expiryDotClasses = {
  ok: 'bg-success',
  soon: 'bg-warning',
  expired: 'bg-danger',
  unknown: 'bg-muted'
} as const satisfies Record<ExpiryTone, string>

/** The words' colour for each expiry tone: the darker text shades, which keep WCAG AA contrast on a card. */
export const expiryTextClasses = {
  ok: 'text-success-soft-foreground',
  soon: 'text-warning-soft-foreground',
  expired: 'text-danger',
  unknown: 'text-muted'
} as const satisfies Record<ExpiryTone, string>

/** The mutation that asks the Engine how to refresh apps: shared, so every Refresh button knows it's under way. */
export const REFRESH_PLAN_KEY = ['refreshPlan'] as const

/** A row's line while its app waits in a refresh: asking Apple first, its turn, or done. */
export const appRunLineKeys = {
  checking: 'apps.run.checking',
  waiting: 'apps.run.waiting',
  done: 'apps.run.done'
} as const satisfies Record<
  Exclude<AppRunState['kind'], 'running'>,
  TranslationKey
>
