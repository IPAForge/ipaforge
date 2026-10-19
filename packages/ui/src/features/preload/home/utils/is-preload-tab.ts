import type { Key } from 'react'

import type { PreloadTab } from '@ui/features/preload/home/types.ts'

export const isPreloadTab = (key: Key): key is PreloadTab =>
  key === 'apps' || key === 'sources'
