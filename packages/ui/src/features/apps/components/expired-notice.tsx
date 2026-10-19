import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type ExpiredNoticeProps = {
  count: number
  canAct: boolean
  onRefresh: () => void
}

/** Apps that expired won't open until they're refreshed (their data is kept): refresh them now. */
export const ExpiredNotice = ({
  count,
  canAct,
  onRefresh
}: ExpiredNoticeProps) => {
  const { t } = useTranslation()

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('apps.expired.title', { count })}</Alert.Title>
        <Alert.Description>{t('apps.expired.body')}</Alert.Description>
      </Alert.Content>
      <Button size="sm" onPress={onRefresh} isDisabled={!canAct}>
        {t('apps.expired.refresh', { count })}
      </Button>
    </Alert>
  )
}
