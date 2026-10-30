import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { PairHeader } from '@ui/features/devices/pair/components/pair-header.tsx'
import { WhereToOpen } from '@ui/features/devices/pair/components/where-to-open.tsx'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type ClosedStepProps = {
  target: PairableDevice
  onBack: () => void
  onClose: () => void
}

/** The device closed its pairing screen (or went away) before pairing finished: open it again, then the list. */
export const ClosedStep = ({ target, onBack, onClose }: ClosedStepProps) => {
  const { t } = useTranslation()
  const name = target.name

  return (
    <>
      <PairHeader title={t('pairByCode.closed.title', { name })} step="code" />
      <Modal.Body className="flex flex-col gap-3">
        <NoticeBox
          status="warning"
          title={t('pairByCode.closed.title', { name })}
          body={t('pairByCode.closed.body', { name })}
        />
        <WhereToOpen />
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" onPress={onClose}>
          {t('prompts.cancel')}
        </Button>
        <Button onPress={onBack} autoFocus>
          {t('pairByCode.backToList')}
        </Button>
      </Modal.Footer>
    </>
  )
}
