type ChoiceClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

/** A channel in the segmented switch: filled in the accent colour when chosen. */
export const segmentClass = ({
  isSelected,
  isFocusVisible
}: ChoiceClassOptions): string =>
  [
    'cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors',
    isSelected
      ? 'bg-accent font-medium text-accent-foreground shadow-sm'
      : 'text-muted hover:text-foreground',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')

/** A variant's card: outlined in the accent colour when chosen. */
export const cardClass = ({
  isSelected,
  isFocusVisible
}: ChoiceClassOptions): string =>
  [
    'flex h-full cursor-pointer flex-col gap-1 rounded-xl border bg-surface p-4 text-start transition-colors',
    isSelected
      ? 'border-accent ring-1 ring-accent'
      : 'border-border hover:bg-surface-secondary',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')
