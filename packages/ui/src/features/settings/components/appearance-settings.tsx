import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { ChoiceGroup } from '@ui/components/choice-group.tsx'
import { PaletteSwatches } from '@ui/features/settings/components/palette-swatches.tsx'
import { modeLabelKey } from '@ui/features/settings/utils/mode-label-key.ts'
import { useTheme } from '@ui/hooks/use-theme.ts'
import { colorModes } from '@ui/theme/constants.ts'

/** Colour mode and palette, saved through the theme store. */
export const AppearanceSettings = () => {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()

  return (
    <Card>
      <Card.Content className="flex flex-col gap-5">
        <h2 className="font-semibold text-lg">{t('settings.appearance')}</h2>
        <ChoiceGroup
          labelKey="settings.mode"
          options={colorModes}
          optionLabelKey={modeLabelKey}
          value={mode}
          onChange={setMode}
        />
        <PaletteSwatches />
      </Card.Content>
    </Card>
  )
}
