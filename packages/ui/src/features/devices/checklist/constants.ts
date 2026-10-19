import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  type LucideIcon,
  Smartphone
} from 'lucide-react'

import type {
  ChecklistGroup,
  ChecklistState
} from '@ui/features/devices/checklist/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** The groups, in order. */
export const checklistGroups = {
  before: 'checklist.group.before',
  after: 'checklist.group.after',
  sidestore: 'checklist.group.sidestore'
} as const satisfies Record<ChecklistGroup, TranslationKey>

/** The groups' order on the page. */
export const CHECKLIST_GROUPS: readonly ChecklistGroup[] = [
  'before',
  'after',
  'sidestore'
]

/** Developer Mode exists from iOS 16; SideStore needs LocalDevVPN from iOS 17. */
export const DEVELOPER_MODE_IOS = 16
export const LOCAL_DEV_VPN_IOS = 17

/** LocalDevVPN on the App Store, as SideStore links it. */
export const LOCAL_DEV_VPN_URL =
  'https://apps.apple.com/app/localdevvpn/id6755608044'

/** Where your ticks are kept, per device. */
export const checklistKey = (udid: string) => `checklist.${udid}`

/** Each state's mark and the colour of its tag. */
export const checklistLooks = {
  done: {
    icon: CircleCheck,
    tone: 'text-success-soft-foreground',
    tag: 'text-success-soft-foreground'
  },
  todo: {
    icon: Circle,
    tone: 'text-warning',
    tag: 'bg-warning-soft text-warning-soft-foreground'
  },
  self: {
    icon: Smartphone,
    tone: 'text-muted',
    tag: 'bg-surface-tertiary text-muted'
  },
  reminder: {
    icon: Smartphone,
    tone: 'text-muted',
    tag: 'bg-surface-tertiary text-muted'
  },
  later: {
    icon: CircleDashed,
    tone: 'text-muted',
    tag: 'bg-surface-tertiary text-muted'
  },
  na: { icon: CircleMinus, tone: 'text-muted', tag: 'text-muted' }
} as const satisfies Record<
  ChecklistState,
  { readonly icon: LucideIcon; readonly tone: string; readonly tag: string }
>
