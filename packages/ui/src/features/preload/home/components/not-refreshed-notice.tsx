import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { timeAgo } from '@ui/features/preload/home/utils/time-ago.ts'
import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type NotRefreshedNoticeProps = {
  source: SourceInfo
  name: string
}

/** A source that couldn't be read again: its apps are from the last good copy; Try again reads it once more. */
export const NotRefreshedNotice = ({
  source,
  name
}: NotRefreshedNoticeProps) => {
  const { t } = useTranslation()
  const { relativeTime } = useFormat()
  const { refresh } = useSourceActions()
  const onRetry = () => refresh.mutate(source.id)

  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t('preload.browse.notRefreshed.title', { name })}
        </Alert.Title>
        {source.fetchedAt ? (
          <Alert.Description>
            {t('preload.browse.notRefreshed.body', {
              when: timeAgo(source.fetchedAt, new Date(), relativeTime)
            })}
          </Alert.Description>
        ) : null}
      </Alert.Content>
      <Button size="sm" onPress={onRetry} isPending={refresh.isPending}>
        {t('preload.browse.notRefreshed.retry')}
      </Button>
    </Alert>
  )
}
