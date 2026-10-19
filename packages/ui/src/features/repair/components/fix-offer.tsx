import { Checkbox, Label } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { fixKeys } from '@ui/features/repair/constants.ts'
import type { Fix } from '@ui/features/repair/types.ts'

type FixOfferProps = {
  fix: Fix
  isPicked: boolean
  isDisabled: boolean
  onChange: (fix: Fix, isPicked: boolean) => void
}

/** A fix Repair offers for a warning or what it can't tell: run it too, if you want. */
export const FixOffer = ({
  fix,
  isPicked,
  isDisabled,
  onChange
}: FixOfferProps) => {
  const { t } = useTranslation()
  const onPickedChange = (picked: boolean) => onChange(fix, picked)

  return (
    <Checkbox
      isSelected={isPicked}
      onChange={onPickedChange}
      isDisabled={isDisabled}
      className="flex w-full flex-row items-start justify-start gap-3 text-start"
    >
      <Checkbox.Control className="mt-0.5 shrink-0">
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
        <Label className="text-sm">{t(fixKeys[fix].offer)}</Label>
      </Checkbox.Content>
    </Checkbox>
  )
}
