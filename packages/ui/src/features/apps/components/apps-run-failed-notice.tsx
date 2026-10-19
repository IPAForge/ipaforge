import { Alert, Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useRun } from '@ui/hooks/use-run.ts'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'

/**
 * A refresh or update started here (or by automatic refresh) that failed: what went wrong, with the run's full
 * recovery (on the Preload page) one press away. Dismiss forgets the run.
 */
export const AppsRunFailedNotice = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { run, dismiss } = useRun()
  const failure = run?.view.failure
  const onDetails = () => void navigate({ to: '/preload' })

  if (run?.kind !== 'apps' || !run.fromApps || !failure) return null

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t('apps.failed.title', {
            reason: t(errorTitleKey(failure.error.code))
          })}
        </Alert.Title>
        <Alert.Description>
          {t(errorBodyKey(failure.error.code))}
        </Alert.Description>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onPress={onDetails}>
            {t('apps.failed.details')}
          </Button>
          <Button size="sm" variant="tertiary" onPress={dismiss}>
            {t('apps.failed.dismiss')}
          </Button>
        </div>
      </Alert.Content>
    </Alert>
  )
}
