import { Button, Modal } from '@heroui/react'
import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { deviceKind } from '@ui/features/devices/utils/device-kind.ts'
import type { CodePairedDevice } from '@ui/services/engine/types.ts'

type PairedStepProps = {
  paired: CodePairedDevice
  /** The name to call it by: its own, or the one its pairing screen gave. */
  name: string
  /** Makes it the device in use (by its udid) and closes the dialog. */
  onUse: (udid: string) => void
  onClose: () => void
}

/** The end: the device is paired and on the Devices page; use it now, or close. */
export const PairedStep = ({
  paired,
  name,
  onUse,
  onClose
}: PairedStepProps) => {
  const { t } = useTranslation()
  const onUseThis = () => onUse(paired.udid)

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{t('pairByCode.done.title', { name })}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-2">
        <p role="status" className="flex items-start gap-2">
          <CircleCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-success"
          />
          {t('pairByCode.done.body', { name })}
        </p>
        {deviceKind(paired.model) === 'vision' ? (
          <p className="text-muted text-sm">{t('pairByCode.done.vision')}</p>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" onPress={onClose}>
          {t('pairByCode.done.close')}
        </Button>
        <Button onPress={onUseThis} autoFocus>
          {t('pairByCode.done.use', { name })}
        </Button>
      </Modal.Footer>
    </>
  )
}
