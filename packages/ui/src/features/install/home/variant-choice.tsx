import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import type { SideStoreVariant } from '@ui/services/engine/engine-types.ts'

const variants = [
  'sidestore',
  'livecontainer'
] as const satisfies readonly SideStoreVariant[]

const isVariant = (value: string): value is SideStoreVariant =>
  (variants as readonly string[]).includes(value)

type CardClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

const cardClass = ({ isSelected, isFocusVisible }: CardClassOptions): string =>
  [
    'flex h-full cursor-pointer flex-col gap-1 rounded-xl border bg-surface p-4 text-start transition-colors',
    isSelected
      ? 'border-accent ring-1 ring-accent'
      : 'border-border hover:bg-surface-secondary',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')

type VariantChoiceProps = {
  value: SideStoreVariant
  onChange: (variant: SideStoreVariant) => void
}

/** SideStore alone, or LiveContainer with SideStore inside, each with the App IDs it uses. */
export const VariantChoice = ({ value, onChange }: VariantChoiceProps) => {
  const { t } = useTranslation()
  const onValueChange = (next: string) => {
    if (isVariant(next)) onChange(next)
  }

  return (
    <RadioGroup
      value={value}
      onChange={onValueChange}
      className="flex flex-col gap-2"
    >
      <Label className="font-medium text-sm">{t('install.home.what')}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {variants.map((variant) => (
          <RadioField key={variant} value={variant}>
            <RadioButton className={cardClass}>
              <span className="font-semibold">
                {t(`install.variant.${variant}.title`)}
              </span>
              <span className="text-muted text-sm">
                {t(`install.variant.${variant}.description`)}
              </span>
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  )
}
