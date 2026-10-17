import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type PageHeaderProps = {
  titleKey: TranslationKey
  descriptionKey?: TranslationKey
}

/** A page's title and optional one-line description. */
export const PageHeader = ({ titleKey, descriptionKey }: PageHeaderProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-semibold text-2xl">{t(titleKey)}</h1>
      {descriptionKey ? (
        <p className="text-muted">{t(descriptionKey)}</p>
      ) : null}
    </div>
  )
}
