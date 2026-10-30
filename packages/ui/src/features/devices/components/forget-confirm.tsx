import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { useForgetCodePaired } from '@ui/hooks/queries/use-code-paired.ts'

type ForgetConfirmProps = {
  udid: string
  name: string
  onCancel: () => void
}

/** "Forget {name}?" in the card: what forgetting does (and doesn't), Forget and Cancel. */
export const ForgetConfirm = ({ udid, name, onCancel }: ForgetConfirmProps) => {
  const { t } = useTranslation()
  const forget = useForgetCodePaired()
  const onForget = () => forget.mutate(udid)

  return (
    <NoticeBox
      status="danger"
      title={t('devices.forget.title', { name })}
      body={t('devices.forget.body')}
      action={
        <>
          <Button
            size="sm"
            variant="danger"
            isPending={forget.isPending}
            onPress={onForget}
          >
            {t('devices.forget.confirm')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={forget.isPending}
            onPress={onCancel}
          >
            {t('prompts.cancel')}
          </Button>
        </>
      }
    />
  )
}
