import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type LogFilterChipProps = { label: string; onRemove: () => void }

/** One active filter, with a button that removes it. */
export const LogFilterChip = ({ label, onRemove }: LogFilterChipProps) => {
  const { t } = useTranslation()

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent py-0.5 ps-2.5 pe-1 text-foreground text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('logs.filters.remove', { filter: label })}
        className="rounded-full p-0.5 text-muted hover:bg-surface-secondary hover:text-foreground"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  )
}
