type SwatchClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

export const swatchClass = ({
  isSelected,
  isFocusVisible
}: SwatchClassOptions): string =>
  [
    'flex h-full cursor-pointer flex-col gap-2 rounded-xl border bg-surface p-2 text-start transition-colors',
    isSelected
      ? 'border-accent ring-1 ring-accent'
      : 'border-border hover:bg-surface-secondary',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')
