import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { runElsewhere } from '@ui/components/constants.ts'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'
import type { RunKind } from '@ui/state/active-run/types.ts'

type RunElsewhereNoticeProps = {
  /** The kind of run this page starts; the notice shows while a run of the other kind holds the device. */
  page: RunKind
}

/** Another install is running (one at a time: it holds the device), with a way to it. */
export const RunElsewhereNotice = ({ page }: RunElsewhereNoticeProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { run } = useRun()
  if (!run || run.kind === page || !isRunActive(run.view)) return null
  const { titleKey, path } = runElsewhere[page]
  const onOpen = () => void navigate({ to: path })

  return (
    <NoticeBox
      status="warning"
      title={t(titleKey)}
      body={t('preload.elsewhere.body')}
      action={
        <Button size="sm" variant="secondary" onPress={onOpen}>
          {t('preload.elsewhere.open')}
        </Button>
      }
    />
  )
}
