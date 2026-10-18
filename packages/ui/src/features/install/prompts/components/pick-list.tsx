import { Chip } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'
import { RadioButton, RadioField, RadioGroup } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import type { PickOption } from '@ui/features/install/prompts/types.ts'
import { pickClass } from '@ui/features/install/prompts/utils/pick-class.ts'

type PickListProps = {
  label: string
  options: readonly PickOption[]
  value: string | undefined
  onChange: (value: string) => void
  isDisabled: boolean
}

/** Answers to pick before confirming (revoking, removing): each with what it is, what it breaks, the suggested one marked. */
export const PickList = ({
  label,
  options,
  value,
  onChange,
  isDisabled
}: PickListProps) => {
  const { t } = useTranslation()

  return (
    <RadioGroup
      aria-label={label}
      value={value ?? null}
      onChange={onChange}
      isDisabled={isDisabled}
      className="flex flex-col gap-2"
    >
      {options.map((option) => (
        <RadioField key={option.value} value={option.value}>
          <RadioButton className={pickClass}>
            <span className="flex items-center gap-2 font-semibold">
              {option.title}
              {option.isSuggested ? (
                <Chip size="sm" color="accent">
                  {t('prompts.suggested')}
                </Chip>
              ) : null}
            </span>
            {option.description ? (
              <span className="text-muted text-sm">{option.description}</span>
            ) : null}
            {option.warning ? (
              <span className="flex items-center gap-1 text-sm text-warning-soft-foreground">
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                {option.warning}
              </span>
            ) : null}
          </RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  )
}
