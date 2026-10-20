import { Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { CHECKING_SHOWN_AFTER_MS } from '@ui/features/updates/constants.ts'
import { useDelayed } from '@ui/features/updates/hooks/use-delayed.ts'

/** Checking for a newer version; said only if the check takes a moment. */
export const UpdateChecking = () => {
  const { t } = useTranslation()
  const isShown = useDelayed(CHECKING_SHOWN_AFTER_MS)

  return isShown ? (
    <>
      <h1 className="font-semibold text-lg">{t('updates.checking.title')}</h1>
      <Spinner aria-hidden="true" />
    </>
  ) : null
}
