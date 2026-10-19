import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { REPAIR_PATH } from '@ui/features/repair/constants.ts'

/** On SideStore's row in Apps: opens Repair SideStore, which checks what keeps it from refreshing apps by itself. */
export const CheckSideStoreButton = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const onOpen = () => void navigate({ to: REPAIR_PATH })

  return (
    <Button size="sm" variant="tertiary" onPress={onOpen}>
      <Wrench aria-hidden="true" className="size-4" />
      {t('repair.open')}
    </Button>
  )
}
