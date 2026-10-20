import { useTranslation } from 'react-i18next'

import { tagClasses } from '@ui/features/developer/constants.ts'
import type { RowTag } from '@ui/features/developer/types.ts'

type RowTagChipProps = {
  tag: RowTag
}

/** A small tag beside a row's name: "This computer's", "Unused", "Expired". */
export const RowTagChip = ({ tag }: RowTagChipProps) => {
  const { t } = useTranslation()

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium text-xs ${tagClasses[tag.tone]}`}
    >
      {tag.values ? t(tag.labelKey, tag.values) : t(tag.labelKey)}
    </span>
  )
}
