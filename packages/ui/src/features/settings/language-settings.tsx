import { Card, Description, ListBox, Select } from '@heroui/react'
import { type Key, useId } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageOptionLabel } from '@ui/features/settings/language-option-label.tsx'
import { useLanguage } from '@ui/hooks/use-language.ts'
import {
  type LanguageChoice,
  SYSTEM_LANGUAGE
} from '@ui/i18n/languages/language-store.ts'
import {
  availableLanguages,
  isAvailableLanguage,
  nativeName
} from '@ui/i18n/languages/languages.ts'

const toChoice = (key: Key | null): LanguageChoice | undefined => {
  const value = String(key)
  if (value === SYSTEM_LANGUAGE) return SYSTEM_LANGUAGE
  return isAvailableLanguage(value) ? value : undefined
}

/**
 * The UI language: follow the system (showing which language that is), or one language, saved in preferences.
 * The select shows the active choice, so it changes only once the new language has loaded.
 */
export const LanguageSettings = () => {
  const { t } = useTranslation()
  const { choice, systemLanguage, choose } = useLanguage()
  const titleId = useId()
  const systemLabel = t('settings.language.system', {
    language: nativeName(systemLanguage)
  })
  const onChange = (key: Key | null) => {
    const next = toChoice(key)
    if (next) void choose(next)
  }

  return (
    <Card>
      <Card.Content className="flex flex-col gap-3">
        <h2 id={titleId} className="font-semibold text-lg">
          {t('settings.language.title')}
        </h2>
        <Select
          aria-labelledby={titleId}
          value={choice}
          onChange={onChange}
          className="max-w-xs"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Description>{t('settings.language.hint')}</Description>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={SYSTEM_LANGUAGE} textValue={systemLabel}>
                {systemLabel}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {availableLanguages.map((language) => (
                <ListBox.Item
                  key={language}
                  id={language}
                  textValue={nativeName(language)}
                >
                  <LanguageOptionLabel language={language} />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </Card.Content>
    </Card>
  )
}
