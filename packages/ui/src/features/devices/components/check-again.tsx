import { Button } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'

type CheckAgainProps = { udid: string }

/** Reads the device's status again. */
export const CheckAgain = ({ udid }: CheckAgainProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const onCheckAgain = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.deviceStatus(udid)
    })

  return (
    <Button size="sm" variant="tertiary" onPress={onCheckAgain}>
      {t('devices.checkAgain')}
    </Button>
  )
}
