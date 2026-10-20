import { Button, Modal } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { EnglishOnlyNote } from '@ui/features/whats-new/components/english-only-note.tsx'
import { ReleaseNotesBody } from '@ui/features/whats-new/components/release-notes-body.tsx'
import { VersionLine } from '@ui/features/whats-new/components/version-line.tsx'
import { WHATS_NEW_PATH } from '@ui/features/whats-new/constants.ts'
import type { ReleaseNotes } from '@ui/features/whats-new/types.ts'

type WhatsNewDialogProps = {
  notes: ReleaseNotes
  onClose: () => void
}

/** What's new in the version IPAForge just updated to: the version in a sentence, its highlights, its other changes. */
export const WhatsNewDialog = ({ notes, onClose }: WhatsNewDialogProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }
  const onEveryVersion = () => {
    onClose()
    void navigate({ to: WHATS_NEW_PATH })
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header className="flex flex-col gap-0.5">
              <Modal.Heading>{t('whatsNew.dialog.title')}</Modal.Heading>
              <VersionLine notes={notes} />
            </Modal.Header>
            {/* Focusable, so its scrolling works from the keyboard too. */}
            <Modal.Body tabIndex={0} className="flex flex-col gap-4">
              <p>{notes.lead}</p>
              <ReleaseNotesBody notes={notes} />
              <EnglishOnlyNote />
            </Modal.Body>
            <Modal.Footer className="flex justify-between gap-2">
              <Button variant="tertiary" onPress={onEveryVersion}>
                {t('whatsNew.dialog.everyVersion')}
              </Button>
              <Button onPress={onClose}>{t('whatsNew.dialog.close')}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
