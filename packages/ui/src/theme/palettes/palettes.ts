import type { Palette, PaletteId } from '@ui/theme/types.ts'

// Each palette but Graphite tints the neutrals with its own hue, enough to tell the palettes apart at a glance, and keeps the accent readable
// against both the background (as a fill) and its foreground (as text on the fill). Muted text keeps at least
// 4.5:1 against every surface (WCAG AA), checked by the accessibility tests.
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
      muted: 'oklch(0.5 0.012 260)',
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
      background: 'oklch(0.972 0.016 240)',
      foreground: 'oklch(0.22 0.035 240)',
      surface: 'oklch(0.993 0.006 240)',
      surfaceSecondary: 'oklch(0.948 0.024 240)',
      surfaceTertiary: 'oklch(0.926 0.03 240)',
      overlay: 'oklch(0.993 0.006 240)',
      muted: 'oklch(0.47 0.05 240)',
      default: 'oklch(0.926 0.03 240)',
      defaultForeground: 'oklch(0.22 0.035 240)',
      border: 'oklch(0.875 0.035 240)',
      separator: 'oklch(0.9 0.03 240)'
    },
    dark: {
      accent: 'oklch(0.72 0.13 230)',
      accentForeground: 'oklch(0.18 0.03 245)',
      background: 'oklch(0.16 0.035 245)',
      foreground: 'oklch(0.97 0.01 245)',
      surface: 'oklch(0.21 0.045 245)',
      surfaceSecondary: 'oklch(0.25 0.045 245)',
      surfaceTertiary: 'oklch(0.28 0.045 245)',
      overlay: 'oklch(0.22 0.045 245)',
      muted: 'oklch(0.73 0.04 245)',
      default: 'oklch(0.28 0.045 245)',
      defaultForeground: 'oklch(0.97 0.01 245)',
      border: 'oklch(0.31 0.045 245)',
      separator: 'oklch(0.26 0.045 245)'
    }
  },
  aurora: {
    light: {
      accent: 'oklch(0.52 0.12 175)',
      accentForeground: 'oklch(0.99 0.005 190)',
      background: 'oklch(0.972 0.016 190)',
      foreground: 'oklch(0.22 0.035 190)',
      surface: 'oklch(0.993 0.006 190)',
      surfaceSecondary: 'oklch(0.948 0.024 190)',
      surfaceTertiary: 'oklch(0.926 0.03 190)',
      overlay: 'oklch(0.993 0.006 190)',
      muted: 'oklch(0.47 0.05 190)',
      default: 'oklch(0.926 0.03 190)',
      defaultForeground: 'oklch(0.22 0.035 190)',
      border: 'oklch(0.875 0.035 190)',
      separator: 'oklch(0.9 0.03 190)'
    },
    dark: {
      accent: 'oklch(0.78 0.13 170)',
      accentForeground: 'oklch(0.18 0.03 200)',
      background: 'oklch(0.16 0.035 270)',
      foreground: 'oklch(0.97 0.01 200)',
      surface: 'oklch(0.21 0.045 270)',
      surfaceSecondary: 'oklch(0.25 0.045 270)',
      surfaceTertiary: 'oklch(0.28 0.045 270)',
      overlay: 'oklch(0.22 0.045 270)',
      muted: 'oklch(0.73 0.04 200)',
      default: 'oklch(0.28 0.045 270)',
      defaultForeground: 'oklch(0.97 0.01 200)',
      border: 'oklch(0.31 0.045 270)',
      separator: 'oklch(0.26 0.045 270)'
    }
  },
  sunset: {
    light: {
      accent: 'oklch(0.56 0.17 40)',
      accentForeground: 'oklch(0.99 0.005 60)',
      background: 'oklch(0.972 0.016 60)',
      foreground: 'oklch(0.22 0.035 45)',
      surface: 'oklch(0.993 0.006 60)',
      surfaceSecondary: 'oklch(0.948 0.024 60)',
      surfaceTertiary: 'oklch(0.926 0.03 60)',
      overlay: 'oklch(0.993 0.006 60)',
      muted: 'oklch(0.47 0.05 45)',
      default: 'oklch(0.926 0.03 60)',
      defaultForeground: 'oklch(0.22 0.035 45)',
      border: 'oklch(0.875 0.035 60)',
      separator: 'oklch(0.9 0.03 60)'
    },
    dark: {
      accent: 'oklch(0.74 0.15 50)',
      accentForeground: 'oklch(0.18 0.03 50)',
      background: 'oklch(0.16 0.035 30)',
      foreground: 'oklch(0.97 0.01 50)',
      surface: 'oklch(0.21 0.045 30)',
      surfaceSecondary: 'oklch(0.25 0.045 30)',
      surfaceTertiary: 'oklch(0.28 0.045 30)',
      overlay: 'oklch(0.22 0.045 30)',
      muted: 'oklch(0.73 0.04 50)',
      default: 'oklch(0.28 0.045 30)',
      defaultForeground: 'oklch(0.97 0.01 50)',
      border: 'oklch(0.31 0.045 30)',
      separator: 'oklch(0.26 0.045 30)'
    }
  },
  forest: {
    light: {
      accent: 'oklch(0.52 0.12 150)',
      accentForeground: 'oklch(0.99 0.005 140)',
      background: 'oklch(0.972 0.016 140)',
      foreground: 'oklch(0.22 0.035 150)',
      surface: 'oklch(0.993 0.006 140)',
      surfaceSecondary: 'oklch(0.948 0.024 140)',
      surfaceTertiary: 'oklch(0.926 0.03 140)',
      overlay: 'oklch(0.993 0.006 140)',
      muted: 'oklch(0.47 0.05 150)',
      default: 'oklch(0.926 0.03 140)',
      defaultForeground: 'oklch(0.22 0.035 150)',
      border: 'oklch(0.875 0.035 140)',
      separator: 'oklch(0.9 0.03 140)'
    },
    dark: {
      accent: 'oklch(0.74 0.13 150)',
      accentForeground: 'oklch(0.18 0.03 150)',
      background: 'oklch(0.16 0.035 155)',
      foreground: 'oklch(0.97 0.01 150)',
      surface: 'oklch(0.21 0.045 155)',
      surfaceSecondary: 'oklch(0.25 0.045 155)',
      surfaceTertiary: 'oklch(0.28 0.045 155)',
      overlay: 'oklch(0.22 0.045 155)',
      muted: 'oklch(0.73 0.04 150)',
      default: 'oklch(0.28 0.045 155)',
      defaultForeground: 'oklch(0.97 0.01 150)',
      border: 'oklch(0.31 0.045 155)',
      separator: 'oklch(0.26 0.045 155)'
    }
  },
  rose: {
    light: {
      accent: 'oklch(0.56 0.18 5)',
      accentForeground: 'oklch(0.99 0.005 350)',
      background: 'oklch(0.972 0.016 350)',
      foreground: 'oklch(0.22 0.035 355)',
      surface: 'oklch(0.993 0.006 350)',
      surfaceSecondary: 'oklch(0.948 0.024 350)',
      surfaceTertiary: 'oklch(0.926 0.03 350)',
      overlay: 'oklch(0.993 0.006 350)',
      muted: 'oklch(0.47 0.05 355)',
      default: 'oklch(0.926 0.03 350)',
      defaultForeground: 'oklch(0.22 0.035 355)',
      border: 'oklch(0.875 0.035 350)',
      separator: 'oklch(0.9 0.03 350)'
    },
    dark: {
      accent: 'oklch(0.75 0.14 5)',
      accentForeground: 'oklch(0.18 0.03 355)',
      background: 'oklch(0.16 0.035 350)',
      foreground: 'oklch(0.97 0.01 355)',
      surface: 'oklch(0.21 0.045 350)',
      surfaceSecondary: 'oklch(0.25 0.045 350)',
      surfaceTertiary: 'oklch(0.28 0.045 350)',
      overlay: 'oklch(0.22 0.045 350)',
      muted: 'oklch(0.73 0.04 355)',
      default: 'oklch(0.28 0.045 350)',
      defaultForeground: 'oklch(0.97 0.01 355)',
      border: 'oklch(0.31 0.045 350)',
      separator: 'oklch(0.26 0.045 350)'
    }
  },
  violet: {
    light: {
      accent: 'oklch(0.53 0.18 295)',
      accentForeground: 'oklch(0.99 0.005 295)',
      background: 'oklch(0.972 0.016 295)',
      foreground: 'oklch(0.22 0.035 295)',
      surface: 'oklch(0.993 0.006 295)',
      surfaceSecondary: 'oklch(0.948 0.024 295)',
      surfaceTertiary: 'oklch(0.926 0.03 295)',
      overlay: 'oklch(0.993 0.006 295)',
      muted: 'oklch(0.47 0.05 295)',
      default: 'oklch(0.926 0.03 295)',
      defaultForeground: 'oklch(0.22 0.035 295)',
      border: 'oklch(0.875 0.035 295)',
      separator: 'oklch(0.9 0.03 295)'
    },
    dark: {
      accent: 'oklch(0.76 0.13 295)',
      accentForeground: 'oklch(0.18 0.03 295)',
      background: 'oklch(0.16 0.035 295)',
      foreground: 'oklch(0.97 0.01 295)',
      surface: 'oklch(0.21 0.045 295)',
      surfaceSecondary: 'oklch(0.25 0.045 295)',
      surfaceTertiary: 'oklch(0.28 0.045 295)',
      overlay: 'oklch(0.22 0.045 295)',
      muted: 'oklch(0.73 0.04 295)',
      default: 'oklch(0.28 0.045 295)',
      defaultForeground: 'oklch(0.97 0.01 295)',
      border: 'oklch(0.31 0.045 295)',
      separator: 'oklch(0.26 0.045 295)'
    }
  },
  mocha: {
    light: {
      accent: 'oklch(0.5 0.08 55)',
      accentForeground: 'oklch(0.99 0.005 60)',
      background: 'oklch(0.972 0.021 60)',
      foreground: 'oklch(0.22 0.046 60)',
      surface: 'oklch(0.993 0.008 60)',
      surfaceSecondary: 'oklch(0.948 0.031 60)',
      surfaceTertiary: 'oklch(0.926 0.039 60)',
      overlay: 'oklch(0.993 0.008 60)',
      muted: 'oklch(0.47 0.065 60)',
      default: 'oklch(0.926 0.039 60)',
      defaultForeground: 'oklch(0.22 0.046 60)',
      border: 'oklch(0.875 0.046 60)',
      separator: 'oklch(0.9 0.039 60)'
    },
    dark: {
      accent: 'oklch(0.74 0.07 60)',
      accentForeground: 'oklch(0.18 0.03 55)',
      background: 'oklch(0.16 0.039 55)',
      foreground: 'oklch(0.97 0.011 55)',
      surface: 'oklch(0.21 0.05 55)',
      surfaceSecondary: 'oklch(0.25 0.05 55)',
      surfaceTertiary: 'oklch(0.28 0.05 55)',
      overlay: 'oklch(0.22 0.05 55)',
      muted: 'oklch(0.73 0.044 55)',
      default: 'oklch(0.28 0.05 55)',
      defaultForeground: 'oklch(0.97 0.011 55)',
      border: 'oklch(0.31 0.05 55)',
      separator: 'oklch(0.26 0.05 55)'
    }
  }
} as const satisfies Readonly<Record<PaletteId, Palette>>
