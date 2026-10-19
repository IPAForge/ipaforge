import { ICON_TINTS, LIGHT_TINT_LUMINANCE } from '@ui/components/constants.ts'
import type { IconColors } from '@ui/components/types.ts'

/** A stable palette colour for a name: the same app gets the same colour on every page. */
const tintFor = (name: string): string => {
  let hash = 0

  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0

  return ICON_TINTS[Math.abs(hash) % ICON_TINTS.length] ?? ICON_TINTS[0]
}

/** sRGB relative luminance (WCAG) of `#rrggbb`. */
const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255

    return channel <= 0.039_28
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** An app icon's tile: the source's tint or one picked by name, with a letter that reads on it. */
export const iconColors = (name: string, tint?: string): IconColors => {
  const background = tint ?? tintFor(name)

  return {
    background,
    color: luminance(background) > LIGHT_TINT_LUMINANCE ? '#111827' : '#ffffff'
  }
}
