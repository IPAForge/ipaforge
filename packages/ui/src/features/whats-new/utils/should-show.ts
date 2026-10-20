import type { WhatsNewCheck } from '@ui/features/whats-new/types.ts'

/**
 * Whether What's new opens by itself: this version has notes and they weren't shown yet. On a new install's first
 * launch there is nothing new to tell, so it stays closed.
 */
export const shouldShowWhatsNew = ({
  hasNotes,
  seen,
  version,
  isFirstLaunch
}: WhatsNewCheck): boolean =>
  hasNotes && seen !== version && !(seen === undefined && isFirstLaunch)
