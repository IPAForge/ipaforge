import { Button } from '@heroui/react'
import { Bug } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ErrorCode } from '@ipaforge/kernel'
import { issueUrl } from '@ui/features/install/recovery/utils/issue-url.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type ReportProblemProps = {
  code: ErrorCode
  diagnostics: string
}

/**
 * Opens a new GitHub issue in the browser with the diagnostics filled in. GitHub shows it for review; nothing is
 * sent until the user submits it there.
 */
export const ReportProblem = ({ code, diagnostics }: ReportProblemProps) => {
  const { t } = useTranslation()
  const { links } = useUiServices()
  const onReport = () =>
    links.open(issueUrl(`Install failed: ${code}`, diagnostics))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="tertiary" onPress={onReport}>
        <Bug aria-hidden="true" className="size-4" />
        {t('recovery.report-issue')}
      </Button>
      <span className="text-muted text-xs">{t('recovery.reportHint')}</span>
    </div>
  )
}
