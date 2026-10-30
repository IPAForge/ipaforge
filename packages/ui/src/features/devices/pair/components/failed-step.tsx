import { Button, Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { IPAForgeError } from '@ipaforge/kernel'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { PairHeader } from '@ui/features/devices/pair/components/pair-header.tsx'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type FailedStepProps = {
  target: PairableDevice
  error: IPAForgeError
  onBack: () => void
  onClose: () => void
}

/** Pairing failed for another reason: what went wrong, in the words every error has, and back to the list. */
export const FailedStep = ({
  target,
  error,
  onBack,
  onClose
}: FailedStepProps) => {
  const { t } = useTranslation()

  return (
    <>
      <PairHeader
        title={t('pairByCode.code.title', { name: target.name })}
        step="code"
      />
      <Modal.Body className="flex flex-col gap-3">
        <NoticeBox
          status="danger"
          title={t(errorTitleKey(error.code))}
          body={t(errorBodyKey(error.code))}
        />
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
