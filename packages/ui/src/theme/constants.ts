import type { ColorScheme } from '@ui/services/system/types.ts'

export const paletteIds = [
  'graphite',
  'ocean',
  'aurora',
  'sunset',
  'forest',
  'rose',
  'violet',
  'mocha'
] as const

export const colorModes = ['system', 'light', 'dark'] as const

export const colorSchemes = [
  'light',
  'dark'
] as const satisfies readonly ColorScheme[]
