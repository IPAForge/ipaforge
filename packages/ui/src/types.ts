import type { RouterHistory } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

import type { Logger } from '@loadstar/kernel'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { createAppRouter } from '@ui/router.tsx'
import type { sectionGroups, sections } from '@ui/sections.ts'

export type SectionGroup = (typeof sectionGroups)[number]
export type SectionGroupId = SectionGroup['id']

export type Section = {
  readonly id: string
  readonly path: `/${string}`
  readonly labelKey: TranslationKey
  readonly icon: LucideIcon
  readonly group: SectionGroupId
}

export type AppSection = (typeof sections)[number]
export type SectionId = AppSection['id']
export type SectionPath = AppSection['path']

export type AppRouterOptions = {
  readonly logger: Logger
  /** Defaults to the browser history; tests pass a memory history. */
  readonly history?: RouterHistory | undefined
}

export type AppRouter = ReturnType<typeof createAppRouter>
