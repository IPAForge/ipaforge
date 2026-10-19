import { useTranslation } from 'react-i18next'

import { CATALOG_SOURCE_ID } from '@ui/features/preload/home/constants.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

/** A source's name as shown: IPAForge's catalog in the user's language, any other by the name it gives itself. */
export const useSourceName = () => {
  const { t } = useTranslation()

  return (source: Pick<SourceInfo, 'id' | 'name'>) =>
    source.id === CATALOG_SOURCE_ID
      ? t('preload.sources.catalogName')
      : source.name
}
