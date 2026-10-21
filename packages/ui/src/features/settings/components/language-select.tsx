import { ListBox, Select } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageOptionLabel } from '@ui/features/settings/components/language-option-label.tsx'
import { toLanguageChoice } from '@ui/features/settings/utils/to-language-choice.ts'
import { useLanguage } from '@ui/hooks/use-language.ts'
import { SYSTEM_LANGUAGE } from '@ui/i18n/languages/language-store.ts'
import { availableLanguages, nativeName } from '@ui/i18n/languages/languages.ts'

type LanguageSelectProps = {
  labelledBy: string
  describedBy: string
}

/**
 * The UI language: follow the system (showing which language that is), or one language, saved in preferences.
 * The select shows the active choice, so it changes only once the new language has loaded.
 */
export const LanguageSelect = ({
  labelledBy,
  describedBy
}: LanguageSelectProps) => {
  const { t } = useTranslation()
  const { choice, systemLanguage, choose } = useLanguage()
  const systemLabel = t('settings.language.system', {
    language: nativeName(systemLanguage)
  })
  const onChange = (key: Key | null) => {
    const next = toLanguageChoice(key)
    if (next) void choose(next)
  }

  return (
    <Select
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={choice}
      onChange={onChange}
      className="w-72 max-w-full"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
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
  )
}
