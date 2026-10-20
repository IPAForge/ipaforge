import type { UpdatePhase } from '@ui/features/updates/types.ts'

/** The phases that keep the app behind the update screen: IPAForge doesn't run an old version while it updates. */
export const blockingPhases = {
  idle: false,
  checking: true,
  downloading: true,
  installing: true,
  failed: true,
  manual: false
} as const satisfies Record<UpdatePhase, boolean>

/** How long the check may go on before the screen says so, so a quick check doesn't flash it. */
export const CHECKING_SHOWN_AFTER_MS = 400

/** A whole, for turning a fraction into a percent. */
export const PERCENT = 100
