import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@ui/hooks/use-theme.ts'
import { palettes } from '@ui/theme/palettes/palettes.ts'
import {
  type PaletteId,
  type PaletteTokens,
  paletteIds
} from '@ui/theme/theme-types.ts'

/** The tokens each swatch previews, in display order. */
const PREVIEW_TOKENS = [
  'accent',
  'background',
  'surfaceTertiary'
] as const satisfies readonly (keyof PaletteTokens)[]

const isPaletteId = (value: string): value is PaletteId =>
  paletteIds.some((id) => id === value)

type PaletteChipsProps = { tokens: PaletteTokens }

/** Small colour chips of one palette. Their colours are palette data shown as a preview, not app theming. */
const PaletteChips = ({ tokens }: PaletteChipsProps) => (
  <span aria-hidden="true" className="flex gap-1">
    {PREVIEW_TOKENS.map((token) => (
      <span
        key={token}
        className="size-4 rounded border border-border"
        style={{ background: tokens[token] }}
      />
    ))}
  </span>
)

type SwatchClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

const swatchClass = ({
  isSelected,
  isFocusVisible
}: SwatchClassOptions): string =>
  [
    'flex cursor-pointer flex-col gap-2 rounded-xl border bg-surface p-3 text-start transition-colors',
    isSelected
      ? 'border-accent ring-1 ring-accent'
      : 'border-border hover:bg-surface-secondary',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')

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
