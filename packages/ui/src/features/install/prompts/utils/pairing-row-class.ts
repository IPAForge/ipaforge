import type { PickRenderState } from '@ui/features/install/prompts/types.ts'

/** A pairing-app row: accent border and tint when ticked, a focus outline from the keyboard. */
export const pairingRowClass = ({
  isSelected,
  isFocusVisible,
  isDisabled
}: PickRenderState): string =>
  [
    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors',
    isSelected
      ? 'border-accent bg-accent-soft'
      : 'border-border bg-surface hover:bg-surface-secondary',
    isDisabled ? 'cursor-default opacity-60' : 'cursor-pointer',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')
