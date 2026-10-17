type SwatchClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

export const swatchClass = ({
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
