import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { PaletteChips } from '@ui/features/settings/components/palette-chips.tsx'
import { isPaletteId } from '@ui/features/settings/utils/is-palette-id.ts'
import { swatchClass } from '@ui/features/settings/utils/swatch-class.ts'
import { useTheme } from '@ui/hooks/use-theme.ts'
import { paletteIds } from '@ui/theme/constants.ts'
import { palettes } from '@ui/theme/palettes/palettes.ts'

/** The palettes as selectable swatches, previewed in the scheme currently shown. */
export const PaletteSwatches = () => {
  const { t } = useTranslation()
  const { palette, scheme, setPalette } = useTheme()
  const onChange = (value: string) => {
    if (isPaletteId(value)) setPalette(value)
  }

  return (
    <RadioGroup
      value={palette}
      onChange={onChange}
      className="flex flex-col gap-2"
    >
      <Label className="font-medium text-sm">{t('settings.palette')}</Label>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
        {paletteIds.map((id) => (
          <RadioField key={id} value={id}>
            <RadioButton className={swatchClass}>
              <PaletteChips tokens={palettes[id][scheme]} />
              <span className="text-sm">{t(`theme.palette.${id}`)}</span>
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  )
}
