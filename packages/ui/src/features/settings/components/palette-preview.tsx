import type { PaletteTokens } from '@ui/theme/types.ts'

type PalettePreviewProps = { tokens: PaletteTokens }

/**
 * A tiny window in one palette: top bar, sidebar, a card on the page and an accent button. Its colours are palette
 * data shown as a preview, not app theming.
 */
export const PalettePreview = ({ tokens }: PalettePreviewProps) => (
  <span
    aria-hidden="true"
    className="grid h-14 w-full grid-cols-[30%_1fr] grid-rows-[0.75rem_1fr] overflow-hidden rounded-lg border border-border"
  >
    <span
      className="col-span-2 border-b"
      style={{ background: tokens.surface, borderColor: tokens.border }}
    />
    <span style={{ background: tokens.surfaceSecondary }} />
    <span
      className="flex flex-col gap-1 p-1.5"
      style={{ background: tokens.background }}
    >
      <span
        className="block h-3.5 rounded"
        style={{ background: tokens.surface }}
      />
      <span
        className="block h-2 w-1/2 rounded-full"
        style={{ background: tokens.accent }}
      />
    </span>
  </span>
)
