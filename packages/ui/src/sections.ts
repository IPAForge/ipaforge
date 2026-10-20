import {
  BadgeCheck,
  Download,
  LayoutGrid,
  PackagePlus,
  ScrollText,
  Settings,
  Smartphone,
  UserRound
} from 'lucide-react'

import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type {
  AppSection,
  Section,
  SectionGroupId,
  SectionPath
} from '@ui/types.ts'

/** The sidebar's groups in display order: the primary actions, then management behind a label. */
export const sectionGroups = [
  { id: 'primary', labelKey: undefined },
  { id: 'manage', labelKey: 'nav.group.manage' }
] as const satisfies readonly {
  readonly id: string
  readonly labelKey: TranslationKey | undefined
}[]

/** The sidebar's sections in display order; the router builds one route per entry. */
export const sections = [
  {
    id: 'install',
    path: '/install',
    labelKey: 'nav.install',
    icon: Download,
    group: 'primary'
  },
  {
    id: 'preload',
    path: '/preload',
    labelKey: 'nav.preload',
    icon: PackagePlus,
    group: 'primary'
  },
  {
    id: 'apps',
    path: '/apps',
    labelKey: 'nav.apps',
    icon: LayoutGrid,
    group: 'primary'
  },
  {
    id: 'devices',
    path: '/devices',
    labelKey: 'nav.devices',
    icon: Smartphone,
    group: 'manage'
  },
  {
    id: 'accounts',
    path: '/accounts',
    labelKey: 'nav.accounts',
    icon: UserRound,
    group: 'manage'
  },
  {
    id: 'developer',
    path: '/developer',
    labelKey: 'nav.developer',
    icon: BadgeCheck,
    group: 'manage'
  },
  {
    id: 'logs',
    path: '/logs',
    labelKey: 'nav.logs',
    icon: ScrollText,
    group: 'manage'
  },
  {
    id: 'settings',
    path: '/settings',
    labelKey: 'nav.settings',
    icon: Settings,
    group: 'manage'
  }
] as const satisfies readonly Section[]

/** Where `/` lands. */
export const homePath: SectionPath = '/install'

export const sectionsInGroup = (group: SectionGroupId): readonly AppSection[] =>
  sections.filter((section) => section.group === group)
