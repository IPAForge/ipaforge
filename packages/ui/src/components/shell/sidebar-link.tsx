import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useRun } from '@ui/hooks/use-run.ts'
import type { AppSection } from '@ui/sections.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

// The router marks the current route with `aria-current="page"`; the styling keys off that attribute.
const LINK_CLASSES = [
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted outline-none',
  'hover:bg-default hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-focus',
  'aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-accent-soft-foreground'
].join(' ')

/** Marks Install while a run goes on, so it is easy to get back to from another section. */
const RunningBadge = () => {
  const { t } = useTranslation()

  return (
    <span
      data-testid="install-running"
      className="ms-auto flex items-center rounded-full bg-accent px-1.5 py-1"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-accent-foreground motion-safe:animate-pulse"
      />
      <span className="sr-only">{t('nav.installRunning')}</span>
    </span>
  )
}

export const SidebarLink = ({ section }: { section: AppSection }) => {
  const { t } = useTranslation()
  const { run } = useRun()
  const Icon = section.icon
  const isRunning = section.id === 'install' && isRunActive(run?.view)

  return (
    <Link to={section.path} className={LINK_CLASSES}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t(section.labelKey)}</span>
      {isRunning ? <RunningBadge /> : null}
    </Link>
  )
}
