import { useEffect, useState } from 'react'

import { WHATS_NEW_SEEN_KEY } from '@ui/features/whats-new/constants.ts'
import { notesFor } from '@ui/features/whats-new/utils/notes-for.ts'
import { shouldShowWhatsNew } from '@ui/features/whats-new/utils/should-show.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import { selectionKeys } from '@ui/state/selection/constants.ts'

/**
 * What's new after an update: open once for the version IPAForge now runs, then remembered as seen. Not on a new
 * install's first launch, which only remembers the version.
 */
export const useWhatsNew = () => {
  const { preferences, appVersion } = useUiServices()
  const notes = notesFor(appVersion)
  const [isOpen, setIsOpen] = useState(() =>
    shouldShowWhatsNew({
      hasNotes: notes !== undefined,
      seen: preferences.read(WHATS_NEW_SEEN_KEY),
      version: appVersion,
      isFirstLaunch: Object.values(selectionKeys).every(
        (key) => preferences.read(key) === undefined
      )
    })
  )

  // Closed, or never opened: this version counts as seen, so the next update has something to compare with.
  useEffect(() => {
    if (!isOpen) preferences.write(WHATS_NEW_SEEN_KEY, appVersion)
  }, [isOpen, preferences, appVersion])

  const onClose = () => setIsOpen(false)

  return { notes, isOpen: isOpen && notes !== undefined, onClose }
}
