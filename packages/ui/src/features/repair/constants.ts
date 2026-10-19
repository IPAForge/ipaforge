import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  LoaderCircle,
  type LucideIcon
} from 'lucide-react'

import type { CheckState, Fix } from '@ui/features/repair/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** Each state's mark and colours: the icon, its tint and the tag beside the title. */
export const checkStateLooks = {
  ok: {
    icon: CircleCheck,
    tone: 'text-success-soft-foreground',
    tag: 'text-success-soft-foreground'
  },
  warn: {
    icon: CircleAlert,
    tone: 'text-warning-soft-foreground',
    tag: 'bg-warning-soft text-warning-soft-foreground'
  },
  bad: {
    icon: CircleX,
    tone: 'text-danger',
    tag: 'bg-danger-soft text-danger-soft-foreground'
  },
  unknown: {
    icon: CircleHelp,
    tone: 'text-muted',
    tag: 'bg-surface-tertiary text-muted'
  },
  checking: {
    icon: LoaderCircle,
    tone: 'animate-spin text-muted motion-reduce:animate-none',
    tag: 'bg-surface-tertiary text-muted'
  }
} as const satisfies Record<
  CheckState,
  { readonly icon: LucideIcon; readonly tone: string; readonly tag: string }
>

/** A fix in the plan: what it does, and the line offering it when it's only a choice. */
export const fixKeys = {
  reinstall: {
    title: 'repair.plan.reinstall',
    body: 'repair.plan.reinstallBody',
    offer: 'repair.plan.offerReinstall'
  },
  profile: {
    title: 'repair.plan.profile',
    body: 'repair.plan.profileBody',
    offer: 'repair.plan.profile'
  },
  pairing: {
    title: 'repair.plan.pairing',
    body: 'repair.plan.pairingBody',
    offer: 'repair.plan.offerPairing'
  }
} as const satisfies Record<
  Fix,
  {
    readonly title: TranslationKey
    readonly body: TranslationKey
    readonly offer: TranslationKey
  }
>

/** What to check on the iPhone itself: IPAForge can't see these. */
export const manualChecks = [
  { title: 'repair.manual.vpn.title', body: 'repair.manual.vpn.body' },
  { title: 'repair.manual.anisette.title', body: 'repair.manual.anisette.body' }
] as const satisfies readonly {
  readonly title: TranslationKey
  readonly body: TranslationKey
}[]

/** Inside this many days SideStore is about to expire: a new profile is part of the repair. */
export const EXPIRES_SOON_DAYS = 2

/** Where Repair SideStore lives (Apps stays highlighted in the sidebar). */
export const REPAIR_PATH = '/apps/sidestore'

/** The pause between one check's result and the next one's, as they come in one by one. */
export const REVEAL_STEP_MS = 150

/** The checks while IPAForge asks, in the order their results come in. */
export const pendingChecks = [
  { id: 'device', titleKey: 'repair.device.title' },
  { id: 'signer', titleKey: 'repair.signer.title' },
  { id: 'version', titleKey: 'repair.version.title' },
  { id: 'expiry', titleKey: 'repair.expiry.title' },
  { id: 'signing', titleKey: 'repair.signing.title' },
  { id: 'own', titleKey: 'repair.own.title' },
  { id: 'pairing', titleKey: 'repair.pairing.title' }
] as const satisfies readonly {
  readonly id: string
  readonly titleKey: TranslationKey
}[]
