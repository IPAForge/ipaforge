import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type StepHeaderProps = {
  titleKey: TranslationKey
  leadKey: TranslationKey
}

/** A step's title and what it's for. */
export const StepHeader = ({ titleKey, leadKey }: StepHeaderProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-balance font-semibold text-2xl">{t(titleKey)}</h1>
      <p className="max-w-prose text-muted">{t(leadKey)}</p>
    </div>
  )
}
