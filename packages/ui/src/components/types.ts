import type { ReactNode } from 'react'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** An app icon tile's colours: its background and the letter on it. */
export type IconColors = {
  readonly background: string
  readonly color: string
}

/** One tab of a page's tabs: its id, its label, how many items it holds (shown beside the label) and its panel. */
export type PageTab<T extends string> = {
  readonly id: T
  readonly labelKey: TranslationKey
  readonly count?: number | undefined
  readonly panel: ReactNode
}
