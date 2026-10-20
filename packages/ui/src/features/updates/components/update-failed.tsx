import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { UpdateIn } from '@ui/features/updates/types.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type UpdateFailedProps = {
  state: UpdateIn<'failed'>
  /** Go on with this version until the next launch. */
  onSkip: () => void
}

/** The download didn't finish: try again, download it from the release page, or go on with this version for now. */
export const UpdateFailed = ({ state, onSkip }: UpdateFailedProps) => {
  const { t } = useTranslation()
  const { updates, links } = useUiServices()
  const onRetry = () => updates.retry()
  const onReleasePage = () => links.open(state.url)

  return (
    <>
      <h1 className="font-semibold text-lg">{t('updates.failed.title')}</h1>
      <p className="text-muted text-sm">
        {t('updates.failed.body', { version: state.version })}
      </p>
      <p className="w-full break-words rounded-lg bg-danger-soft px-3 py-2 text-danger-soft-foreground text-xs">
        {state.reason}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onPress={onRetry}>{t('updates.failed.retry')}</Button>
        <Button variant="secondary" onPress={onReleasePage}>
          {t('updates.failed.releasePage')}
        </Button>
      </div>
      <Button size="sm" variant="ghost" onPress={onSkip}>
        {t('updates.failed.skip')}
      </Button>
    </>
  )
}
