import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { SideStoreLinkPanel } from '@ui/features/preload/sidestore/components/sidestore-link-panel.tsx'
import { sideStoreSourceLink } from '@ui/features/preload/sidestore/utils/sidestore-links.ts'
import { useDeviceInUse } from '@ui/hooks/use-selection.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type AddToSideStoreDialogProps = {
  /** The sources to add, one code after another (SideStore adds one source per link). */
  sources: readonly SourceInfo[]
  nameOf: (source: SourceInfo) => string
  onClose: () => void
}

/** Adds sources you added here to SideStore on the iPhone: a code to scan for each, with Previous and Next. */
export const AddToSideStoreDialog = ({
  sources,
  nameOf,
  onClose
}: AddToSideStoreDialogProps) => {
  const { t } = useTranslation()
  const inUse = useDeviceInUse()
  const device = useDeviceView(inUse?.udid, inUse?.device).name
  const [at, setAt] = useState(0)
  const source = sources[at]
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }
  const onPrevious = () => setAt((current) => Math.max(0, current - 1))
  const onNext = () =>
    setAt((current) => Math.min(sources.length - 1, current + 1))

  if (!source) return null

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {t('sidestore.sourceTitle', { name: nameOf(source) })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <SideStoreLinkPanel
                link={sideStoreSourceLink(source.url)}
                askKey="sidestore.steps.addSource"
                body={t('sidestore.sourceBody')}
                device={device}
              />
              {sources.length > 1 ? (
                <div className="flex items-center justify-between gap-2 text-muted text-sm">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={onPrevious}
                    isDisabled={at === 0}
                  >
                    {t('sidestore.previous')}
                  </Button>
                  <span>
                    {t('sidestore.step', { at: at + 1, count: sources.length })}
                  </span>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={onNext}
                    isDisabled={at === sources.length - 1}
                  >
                    {t('sidestore.next')}
                  </Button>
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button onPress={onClose}>{t('sidestore.done')}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
