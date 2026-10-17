import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import {
  directionOf,
  isDraftLanguage,
  type LanguageId,
  nativeName
} from '@ui/i18n/languages/languages.ts'

type LanguageOptionLabelProps = { language: LanguageId }

/** A language's own name, marked up in that language, plus a "draft" chip while it awaits native review. */
export const LanguageOptionLabel = ({ language }: LanguageOptionLabelProps) => {
  const { t } = useTranslation()

  return (
    <span className="flex items-center gap-2">
      <span lang={language} dir={directionOf(language)}>
        {nativeName(language)}
      </span>
      {isDraftLanguage(language) ? (
        <Chip size="sm" variant="soft" color="warning">
          {t('settings.language.draft')}
        </Chip>
      ) : null}
    </span>
  )
}
