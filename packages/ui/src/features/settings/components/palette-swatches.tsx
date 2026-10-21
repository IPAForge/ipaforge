import { RadioButton, RadioField, RadioGroup } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { PalettePreview } from '@ui/features/settings/components/palette-preview.tsx'
import { isPaletteId } from '@ui/features/settings/utils/is-palette-id.ts'
import { swatchClass } from '@ui/features/settings/utils/swatch-class.ts'
import { useTheme } from '@ui/hooks/use-theme.ts'
import { paletteIds } from '@ui/theme/constants.ts'
import { palettes } from '@ui/theme/palettes/palettes.ts'

type PaletteSwatchesProps = { labelledBy: string }

/** The palettes as selectable cards, each a small preview of the app in the scheme currently shown. */
export const PaletteSwatches = ({ labelledBy }: PaletteSwatchesProps) => {
  const { t } = useTranslation()
  const { palette, scheme, setPalette } = useTheme()
  const onChange = (value: string) => {
    if (isPaletteId(value)) setPalette(value)
  }

  return (
    <RadioGroup
      value={palette}
      onChange={onChange}
      aria-labelledby={labelledBy}
      className="grid w-full grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2"
    >
      {paletteIds.map((id) => (
        <RadioField key={id} value={id}>
          <RadioButton className={swatchClass}>
            <PalettePreview tokens={palettes[id][scheme]} />
            <span className="px-1 text-sm">{t(`theme.palette.${id}`)}</span>
          </RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  )
}
