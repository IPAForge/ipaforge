import type { PickRenderState } from '@ui/features/install/prompts/types.ts'

/** A pick-list row: accent ring and tint when picked, a focus outline from the keyboard. */
export const pickClass = ({
  isSelected,
  isFocusVisible,
  isDisabled
}: PickRenderState): string =>
  [
    'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-start transition-colors',
    isSelected
      ? 'border-accent bg-accent-soft ring-1 ring-accent'
      : 'border-border bg-surface hover:bg-surface-secondary',
    isDisabled ? 'cursor-default opacity-60' : 'cursor-pointer',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')
