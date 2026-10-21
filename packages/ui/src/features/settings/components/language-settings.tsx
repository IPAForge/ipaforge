import { Card } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSelect } from '@ui/features/settings/components/language-select.tsx'

/** The language on its own card, with its hint (the setup guide's Welcome step). */
export const LanguageSettings = () => {
  const { t } = useTranslation()
  const titleId = useId()
  const hintId = useId()

  return (
    <Card>
      <Card.Content className="flex flex-col gap-3">
        <h2 id={titleId} className="font-semibold text-lg">
          {t('settings.language.title')}
        </h2>
        <LanguageSelect labelledBy={titleId} describedBy={hintId} />
        <p id={hintId} className="text-muted text-sm">
          {t('settings.language.hint')}
        </p>
      </Card.Content>
    </Card>
  )
}
