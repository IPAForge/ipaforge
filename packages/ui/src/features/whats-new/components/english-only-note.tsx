import { useTranslation } from 'react-i18next'

import { useLanguage } from '@ui/hooks/use-language.ts'

/** Says the notes are in English, in any other language. */
export const EnglishOnlyNote = () => {
  const { t } = useTranslation()
  const { locale } = useLanguage()

  return locale === 'en' ? null : (
    <p className="text-muted text-xs">{t('whatsNew.englishOnly')}</p>
  )
}
