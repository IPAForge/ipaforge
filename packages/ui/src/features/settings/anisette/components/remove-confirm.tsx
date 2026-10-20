import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type RemoveConfirmProps = {
  name: string
  isPending: boolean
  onRemove: () => void
  onCancel: () => void
}

/** Under a server the user added: Remove it? with Remove and Cancel. */
export const RemoveConfirm = ({
  name,
  isPending,
  onRemove,
  onCancel
}: RemoveConfirmProps) => {
  const { t } = useTranslation()

  return (
    <div className="col-span-full flex flex-wrap items-center gap-2 text-muted text-sm">
      {t('settings.anisette.confirmRemove', { name })}
      <Button
        size="sm"
        variant="danger-soft"
        isPending={isPending}
        onPress={onRemove}
      >
        {t('settings.anisette.removeYes')}
      </Button>
      <Button size="sm" variant="ghost" onPress={onCancel}>
        {t('prompts.cancel')}
      </Button>
    </div>
  )
}
