import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useLogView } from '@ui/hooks/use-log-view.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

type ShowLogsProps = { run: ActiveRun }

/** Opens Logs showing only this run's lines, from when it started to when it ended. */
export const ShowLogs = ({ run }: ShowLogsProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showRun } = useLogView()
  const onShow = () => {
    showRun({ from: run.startedAt, to: run.endedAt })
    void navigate({ to: '/logs' })
  }

  return (
    <Button variant="tertiary" onPress={onShow}>
      <ScrollText aria-hidden="true" className="size-4" />
      {t('install.failed.showLogs')}
    </Button>
  )
}
