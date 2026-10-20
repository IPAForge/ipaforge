import { Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { UpdateIn } from '@ui/features/updates/types.ts'

type UpdateInstallingProps = { state: UpdateIn<'installing'> }

/** Downloaded: IPAForge quits, installs it and opens again. */
export const UpdateInstalling = ({ state }: UpdateInstallingProps) => {
  const { t } = useTranslation()

  return (
    <>
      <h1 className="font-semibold text-lg">
        {t('updates.installing.title', { version: state.version })}
      </h1>
      <Spinner aria-hidden="true" />
      <p className="text-muted text-sm">{t('updates.installing.body')}</p>
    </>
  )
}
