import { Alert, Spinner } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type PortalListProps = {
  label: string
  isPending: boolean
  error: unknown
  isEmpty: boolean
  emptyKey: TranslationKey
  children: ReactNode
}

/** A tab's list, or what stands in for it: reading, why it couldn't be read, or that there's nothing yet. */
export const PortalList = ({
  label,
  isPending,
  error,
  isEmpty,
  emptyKey,
  children
}: PortalListProps) => {
  const { t } = useTranslation()
  if (error)
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>
            {t(errorTitleKey(toIPAForgeError(error).code))}
          </Alert.Title>
        </Alert.Content>
      </Alert>
    )
  if (isPending)
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" aria-label={t('portal.reading')} />
      </div>
    )
  if (isEmpty) return <p className="text-muted text-sm">{t(emptyKey)}</p>

  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {children}
    </ul>
  )
}
