import { useUpdateState } from '@ui/features/updates/hooks/use-update-state.ts'
import { WhatsNewDialog } from '@ui/features/whats-new/components/whats-new-dialog.tsx'
import { useWhatsNew } from '@ui/features/whats-new/hooks/use-whats-new.ts'

/** Opens What's new by itself once after an update, unless an update is waiting to be downloaded. */
export const WhatsNewHost = () => {
  const { notes, isOpen, onClose } = useWhatsNew()
  const isUpdateWaiting = useUpdateState().phase !== 'idle'

  return isOpen && notes && !isUpdateWaiting ? (
    <WhatsNewDialog notes={notes} onClose={onClose} />
  ) : null
}
