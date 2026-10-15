import type { ColorScheme } from "@ui/services/color-scheme-source.ts";

export const paletteIds = ["graphite", "ocean", "aurora", "sunset", "forest", "rose"] as const;
export type PaletteId = (typeof paletteIds)[number];

export const colorModes = ["system", "light", "dark"] as const;
/** What the user picked; `system` follows the OS and resolves to a `ColorScheme`. */
export type ColorMode = (typeof colorModes)[number];

export const colorSchemes = ["light", "dark"] as const satisfies readonly ColorScheme[];

/**
 * The base colours of a palette, as oklch strings. HeroUI derives the rest (hover, soft and
 * secondary border shades) from these with `color-mix()`.
 */
export interface PaletteTokens {
  readonly accent: string;
  readonly accentForeground: string;
  readonly background: string;
  readonly foreground: string;
  readonly surface: string;
  readonly surfaceSecondary: string;
  readonly surfaceTertiary: string;
  readonly overlay: string;
  readonly muted: string;
  readonly default: string;
  readonly defaultForeground: string;
  readonly border: string;
  readonly separator: string;
}

export type Palette = Readonly<Record<ColorScheme, PaletteTokens>>;
