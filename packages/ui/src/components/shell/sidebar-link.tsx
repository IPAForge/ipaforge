import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LINK_CLASSES } from '@ui/components/shell/constants.ts'
import { RunningBadge } from '@ui/components/shell/running-badge.tsx'
import { AppsBadge } from '@ui/features/apps/components/apps-badge.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'
import type { AppSection } from '@ui/types.ts'

type SidebarLinkProps = { section: AppSection }

export const SidebarLink = ({ section }: SidebarLinkProps) => {
  const { t } = useTranslation()
  const { run } = useRun()
  const Icon = section.icon
  // The badge sits on the section of the run going on: Install for SideStore, Preload for apps.
  const runSection = run?.kind === 'apps' ? 'preload' : 'install'
  const isRunning = section.id === runSection && isRunActive(run?.view)

  return (
    <Link to={section.path} className={LINK_CLASSES}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{t(section.labelKey)}</span>
      {isRunning ? <RunningBadge /> : null}
      {section.id === 'apps' && !isRunning ? <AppsBadge /> : null}
    </Link>
  )
}
