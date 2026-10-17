import { PREVIEW_TOKENS } from '@ui/features/settings/constants.ts'
import type { PaletteTokens } from '@ui/theme/types.ts'

type PaletteChipsProps = { tokens: PaletteTokens }

/** Small colour chips of one palette. Their colours are palette data shown as a preview, not app theming. */
export const PaletteChips = ({ tokens }: PaletteChipsProps) => (
  <span aria-hidden="true" className="flex gap-1">
    {PREVIEW_TOKENS.map((token) => (
      <span
        key={token}
        className="size-4 rounded border border-border"
        style={{ background: tokens[token] }}
      />
    ))}
  </span>
)
