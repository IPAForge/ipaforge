import type { Palette, PaletteId } from '@ui/theme/theme-types.ts'

// Each palette tints the neutrals with its own hue at low chroma and keeps the accent readable
// against both the background (as a fill) and its foreground (as text on the fill).
export const palettes = {
  graphite: {
    light: {
      accent: 'oklch(0.45 0.03 260)',
      accentForeground: 'oklch(0.99 0 0)',
      background: 'oklch(0.975 0.002 260)',
      foreground: 'oklch(0.21 0.006 260)',
      surface: 'oklch(1 0 0)',
      surfaceSecondary: 'oklch(0.955 0.003 260)',
      surfaceTertiary: 'oklch(0.94 0.003 260)',
      overlay: 'oklch(1 0 0)',
      muted: 'oklch(0.55 0.012 260)',
      default: 'oklch(0.94 0.003 260)',
      defaultForeground: 'oklch(0.21 0.006 260)',
      border: 'oklch(0.9 0.004 260)',
      separator: 'oklch(0.92 0.004 260)'
    },
    dark: {
      accent: 'oklch(0.78 0.03 260)',
      accentForeground: 'oklch(0.18 0.006 260)',
      background: 'oklch(0.15 0.004 260)',
      foreground: 'oklch(0.97 0.002 260)',
      surface: 'oklch(0.21 0.006 260)',
      surfaceSecondary: 'oklch(0.25 0.006 260)',
      surfaceTertiary: 'oklch(0.28 0.006 260)',
      overlay: 'oklch(0.22 0.006 260)',
      muted: 'oklch(0.7 0.012 260)',
      default: 'oklch(0.28 0.006 260)',
      defaultForeground: 'oklch(0.97 0.002 260)',
      border: 'oklch(0.29 0.006 260)',
      separator: 'oklch(0.26 0.006 260)'
    }
  },
  ocean: {
    light: {
      accent: 'oklch(0.55 0.15 240)',
      accentForeground: 'oklch(0.99 0.005 240)',
      background: 'oklch(0.975 0.006 240)',
      foreground: 'oklch(0.22 0.03 245)',
      surface: 'oklch(0.995 0.003 240)',
      surfaceSecondary: 'oklch(0.955 0.01 240)',
      surfaceTertiary: 'oklch(0.935 0.012 240)',
      overlay: 'oklch(0.995 0.003 240)',
      muted: 'oklch(0.54 0.03 240)',
      default: 'oklch(0.935 0.012 240)',
      defaultForeground: 'oklch(0.22 0.03 245)',
      border: 'oklch(0.89 0.015 240)',
      separator: 'oklch(0.91 0.012 240)'
    },
    dark: {
      accent: 'oklch(0.72 0.13 230)',
      accentForeground: 'oklch(0.17 0.03 245)',
      background: 'oklch(0.16 0.025 245)',
      foreground: 'oklch(0.97 0.006 240)',
      surface: 'oklch(0.21 0.03 245)',
      surfaceSecondary: 'oklch(0.25 0.03 245)',
      surfaceTertiary: 'oklch(0.28 0.03 245)',
      overlay: 'oklch(0.22 0.03 245)',
      muted: 'oklch(0.71 0.03 240)',
      default: 'oklch(0.28 0.03 245)',
      defaultForeground: 'oklch(0.97 0.006 240)',
      border: 'oklch(0.3 0.03 245)',
      separator: 'oklch(0.26 0.03 245)'
    }
  },
  aurora: {
    light: {
      accent: 'oklch(0.55 0.12 175)',
      accentForeground: 'oklch(0.99 0.005 175)',
      background: 'oklch(0.975 0.006 190)',
      foreground: 'oklch(0.22 0.025 200)',
      surface: 'oklch(0.995 0.003 190)',
      surfaceSecondary: 'oklch(0.955 0.01 190)',
      surfaceTertiary: 'oklch(0.935 0.012 190)',
      overlay: 'oklch(0.995 0.003 190)',
      muted: 'oklch(0.54 0.03 195)',
      default: 'oklch(0.935 0.012 190)',
      defaultForeground: 'oklch(0.22 0.025 200)',
      border: 'oklch(0.89 0.015 190)',
      separator: 'oklch(0.91 0.012 190)'
    },
    dark: {
      accent: 'oklch(0.78 0.13 170)',
      accentForeground: 'oklch(0.18 0.03 200)',
      background: 'oklch(0.16 0.03 270)',
      foreground: 'oklch(0.97 0.008 190)',
      surface: 'oklch(0.21 0.035 270)',
      surfaceSecondary: 'oklch(0.25 0.035 270)',
      surfaceTertiary: 'oklch(0.28 0.035 270)',
      overlay: 'oklch(0.22 0.035 270)',
      muted: 'oklch(0.72 0.03 220)',
      default: 'oklch(0.28 0.035 270)',
      defaultForeground: 'oklch(0.97 0.008 190)',
      border: 'oklch(0.3 0.035 270)',
      separator: 'oklch(0.26 0.035 270)'
    }
  },
  sunset: {
    light: {
      accent: 'oklch(0.58 0.17 40)',
      accentForeground: 'oklch(0.99 0.005 60)',
      background: 'oklch(0.977 0.008 60)',
      foreground: 'oklch(0.23 0.03 40)',
      surface: 'oklch(0.997 0.003 60)',
      surfaceSecondary: 'oklch(0.956 0.012 60)',
      surfaceTertiary: 'oklch(0.937 0.015 60)',
      overlay: 'oklch(0.997 0.003 60)',
      muted: 'oklch(0.55 0.035 45)',
      default: 'oklch(0.937 0.015 60)',
      defaultForeground: 'oklch(0.23 0.03 40)',
      border: 'oklch(0.89 0.018 60)',
      separator: 'oklch(0.91 0.015 60)'
    },
    dark: {
      accent: 'oklch(0.74 0.15 50)',
      accentForeground: 'oklch(0.18 0.03 40)',
      background: 'oklch(0.16 0.02 30)',
      foreground: 'oklch(0.97 0.008 60)',
      surface: 'oklch(0.21 0.025 30)',
      surfaceSecondary: 'oklch(0.25 0.025 30)',
      surfaceTertiary: 'oklch(0.28 0.025 30)',
      overlay: 'oklch(0.22 0.025 30)',
      muted: 'oklch(0.72 0.03 50)',
      default: 'oklch(0.28 0.025 30)',
      defaultForeground: 'oklch(0.97 0.008 60)',
      border: 'oklch(0.3 0.025 30)',
      separator: 'oklch(0.26 0.025 30)'
    }
  },
  forest: {
    light: {
      accent: 'oklch(0.52 0.12 150)',
      accentForeground: 'oklch(0.99 0.005 150)',
      background: 'oklch(0.975 0.006 140)',
      foreground: 'oklch(0.22 0.025 150)',
      surface: 'oklch(0.995 0.003 140)',
      surfaceSecondary: 'oklch(0.955 0.01 140)',
      surfaceTertiary: 'oklch(0.935 0.012 140)',
      overlay: 'oklch(0.995 0.003 140)',
      muted: 'oklch(0.54 0.03 150)',
      default: 'oklch(0.935 0.012 140)',
      defaultForeground: 'oklch(0.22 0.025 150)',
      border: 'oklch(0.89 0.015 140)',
      separator: 'oklch(0.91 0.012 140)'
    },
    dark: {
      accent: 'oklch(0.74 0.13 150)',
      accentForeground: 'oklch(0.18 0.03 150)',
      background: 'oklch(0.16 0.02 155)',
      foreground: 'oklch(0.97 0.008 140)',
      surface: 'oklch(0.21 0.025 155)',
      surfaceSecondary: 'oklch(0.25 0.025 155)',
      surfaceTertiary: 'oklch(0.28 0.025 155)',
      overlay: 'oklch(0.22 0.025 155)',
      muted: 'oklch(0.71 0.03 150)',
      default: 'oklch(0.28 0.025 155)',
      defaultForeground: 'oklch(0.97 0.008 140)',
      border: 'oklch(0.3 0.025 155)',
      separator: 'oklch(0.26 0.025 155)'
    }
  },
  rose: {
    light: {
      accent: 'oklch(0.56 0.18 5)',
      accentForeground: 'oklch(0.99 0.005 5)',
      background: 'oklch(0.977 0.007 350)',
      foreground: 'oklch(0.23 0.03 0)',
      surface: 'oklch(0.997 0.003 350)',
      surfaceSecondary: 'oklch(0.956 0.011 350)',
      surfaceTertiary: 'oklch(0.937 0.014 350)',
      overlay: 'oklch(0.997 0.003 350)',
      muted: 'oklch(0.55 0.035 355)',
      default: 'oklch(0.937 0.014 350)',
      defaultForeground: 'oklch(0.23 0.03 0)',
      border: 'oklch(0.89 0.017 350)',
      separator: 'oklch(0.91 0.014 350)'
    },
    dark: {
      accent: 'oklch(0.75 0.14 5)',
      accentForeground: 'oklch(0.18 0.03 0)',
      background: 'oklch(0.16 0.02 350)',
      foreground: 'oklch(0.97 0.008 350)',
      surface: 'oklch(0.21 0.025 350)',
      surfaceSecondary: 'oklch(0.25 0.025 350)',
      surfaceTertiary: 'oklch(0.28 0.025 350)',
      overlay: 'oklch(0.22 0.025 350)',
      muted: 'oklch(0.72 0.03 355)',
      default: 'oklch(0.28 0.025 350)',
      defaultForeground: 'oklch(0.97 0.008 350)',
      border: 'oklch(0.3 0.025 350)',
      separator: 'oklch(0.26 0.025 350)'
    }
  }
} as const satisfies Readonly<Record<PaletteId, Palette>>
