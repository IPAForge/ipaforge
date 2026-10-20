import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type NativeBuildDialogProps = {
  /** Where the Apple silicon build is. */
  url: string
  onLater: () => void
}

/**
 * The Intel build is running under Rosetta on an Apple silicon Mac, where everything is slower: says so, and where
 * the Apple silicon build is. Installing it over this one keeps everything.
 */
export const NativeBuildDialog = ({ url, onLater }: NativeBuildDialogProps) => {
  const { t } = useTranslation()
  const { links } = useUiServices()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onLater()
  }
  const onDownload = () => {
    links.open(url)
    onLater()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog role="alertdialog">
            <Modal.Header>
              <Modal.Heading>{t('updates.nativeBuild.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>{t('updates.nativeBuild.body')}</p>
              <code className="break-all rounded-lg bg-surface-secondary px-3 py-2 text-muted text-xs">
                {t('updates.nativeBuild.file')}
              </code>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="tertiary" onPress={onLater}>
                {t('updates.nativeBuild.later')}
              </Button>
              <Button onPress={onDownload}>
                {t('updates.nativeBuild.download')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
