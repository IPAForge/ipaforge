import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { variants } from '@ui/features/install/home/constants.ts'
import { cardClass } from '@ui/features/install/home/utils/choice-classes.ts'
import { isVariant } from '@ui/features/install/home/utils/is-choice.ts'
import type { SideStoreVariant } from '@ui/services/engine/types.ts'

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
