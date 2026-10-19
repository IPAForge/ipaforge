import { Button } from '@heroui/react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { RowChips } from '@ui/features/preload/home/components/row-chips.tsx'
import { RowProblem } from '@ui/features/preload/home/components/row-problem.tsx'
import type { PreloadRow as Row } from '@ui/features/preload/home/types.ts'
import { sourceLine } from '@ui/features/preload/home/utils/source-line.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type PreloadRowProps = {
  row: Row
  onRemove: (id: string) => void
}

/** An app in the list: its name and version once read, where it comes from, its facts or why it can't install. */
export const PreloadRow = ({ row, onRemove }: PreloadRowProps) => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()
  const { item, plan, problem } = row
  const name = plan?.inspection.app.name ?? item.label
  const version = plan?.inspection.app.version
  const from = sourceLine(
    item,
    {
      catalog: t('preload.row.fromCatalog'),
      source: (name) => t('preload.row.fromSource', { name })
    },
    fileSize
  )
  const onPress = () => onRemove(item.id)

  return (
    <li
      className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl border bg-surface px-3 py-2.5 ${problem ? 'border-danger/40' : 'border-border'}`}
    >
      <AppIcon name={name} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-2 font-semibold">
          {name}
          {version && !problem ? (
            <span className="font-normal text-muted text-sm">{version}</span>
          ) : null}
        </p>
        <p className="break-all text-muted text-xs">{from}</p>
      </div>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={t('preload.row.remove', { name })}
        onPress={onPress}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
      <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-1.5">
        <RowChips row={row} />
      </div>
      {problem ? <RowProblem problem={problem} /> : null}
    </li>
  )
}
