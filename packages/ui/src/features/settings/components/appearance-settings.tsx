import { Card } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { ChoiceGroup } from '@ui/components/choice-group.tsx'
import { LanguageSelect } from '@ui/features/settings/components/language-select.tsx'
import { PaletteSwatches } from '@ui/features/settings/components/palette-swatches.tsx'
import { SettingRow } from '@ui/features/settings/components/setting-row.tsx'
import { modeLabelKey } from '@ui/features/settings/utils/mode-label-key.ts'
import { useTheme } from '@ui/hooks/use-theme.ts'
import { colorModes } from '@ui/theme/constants.ts'

/** Colour mode, palette and language, one row each, saved through the theme and language stores. */
export const AppearanceSettings = () => {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const modeId = useId()
  const paletteId = useId()
  const languageId = useId()
  const languageHintId = useId()

  return (
    <Card>
      <Card.Content className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">{t('settings.appearance')}</h2>
        <div className="flex flex-col">
          <SettingRow
            titleId={modeId}
            title={t('settings.mode')}
            hint={t('settings.modeHint')}
          >
            <ChoiceGroup
              labelledBy={modeId}
              options={colorModes}
              optionLabelKey={modeLabelKey}
              value={mode}
              onChange={setMode}
            />
          </SettingRow>
          <SettingRow
            titleId={paletteId}
            title={t('settings.palette')}
            hint={t('settings.paletteHint')}
            isFull
          >
            <PaletteSwatches labelledBy={paletteId} />
          </SettingRow>
          <SettingRow
            titleId={languageId}
            title={t('settings.language.title')}
            hint={t('settings.language.hint')}
            hintId={languageHintId}
          >
            <LanguageSelect
              labelledBy={languageId}
              describedBy={languageHintId}
            />
          </SettingRow>
        </div>
      </Card.Content>
    </Card>
  )
}
