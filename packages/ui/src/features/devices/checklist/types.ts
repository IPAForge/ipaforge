import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/**
 * How a line stands: done (seen, or ticked by you), to do (seen not done), on the iPhone (yours to do and tick),
 * a reminder (true each time, nothing to tick), later (after something else), or not needed on this iOS.
 */
export type ChecklistState =
  | 'done'
  | 'todo'
  | 'self'
  | 'reminder'
  | 'later'
  | 'na'

/** What a line can do: ask the device to trust again, show Developer Mode in Settings, LocalDevVPN's code, Repair. */
export type ChecklistAction = 'pair' | 'reveal' | 'vpnCode' | 'repair'

export type ChecklistGroup = 'before' | 'after' | 'sidestore'

export type ChecklistItem = {
  readonly id: string
  readonly group: ChecklistGroup
  readonly state: ChecklistState
  readonly titleKey: TranslationKey
  readonly tagKey: TranslationKey
  /** What to do, a paragraph or steps; none once it's done. */
  readonly howKeys?: readonly TranslationKey[]
  readonly action?: ChecklistAction
  /** You tick it yourself (IPAForge can't see it); done when ticked. */
  readonly isTickable?: boolean
}

/** What the checklist is worked out from: the device's status, what's installed, and what you ticked. */
export type ChecklistFacts = {
  readonly iosMajor: number | undefined
  readonly isConnected: boolean
  readonly isTrusted: boolean
  readonly isLocked: boolean
  readonly developerMode: 'on' | 'off' | 'not_required' | 'unknown' | undefined
  /** An app IPAForge signed is on the device (then the developer has to be trusted). */
  readonly hasInstalled: boolean
  readonly hasSideStore: boolean
  readonly hasLocalDevVpn: boolean
  readonly ticked: ReadonlySet<string>
}

/** How far along: the lines to do or done, and how many are left (all, and the ones IPAForge sees). */
export type ChecklistProgress = {
  readonly done: number
  readonly total: number
  readonly left: number
  readonly seenLeft: number
}
