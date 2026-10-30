import { Button, Modal } from '@heroui/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { PairHeader } from '@ui/features/devices/pair/components/pair-header.tsx'
import { useCountdown } from '@ui/features/devices/pair/hooks/use-countdown.ts'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type BackoffStepProps = {
  target: PairableDevice
  /** When the device takes codes again; undefined when it didn't say. */
  until: number | undefined
  onBack: () => void
  onClose: () => void
}

/**
 * Too many wrong codes: how long the device makes you wait, counting down. Once it's over the list comes back, to
 * pair again (with a new code).
 */
export const BackoffStep = ({
  target,
  until,
  onBack,
  onClose
}: BackoffStepProps) => {
  const { t } = useTranslation()
  const seconds = useCountdown(until)
  const back = useRef(onBack)
  back.current = onBack
  const isOver = until !== undefined && seconds === 0
  useEffect(() => {
    if (isOver) back.current()
  }, [isOver])
  const name = target.name

  return (
    <>
      <PairHeader title={t('pairByCode.code.title', { name })} step="code" />
      <Modal.Body className="flex flex-col gap-3">
        <NoticeBox
          status="warning"
          title={t('pairByCode.backoff.title')}
          body={
            until === undefined
              ? t('pairByCode.backoff.later', { name })
              : t('pairByCode.backoff.wait', { name, seconds })
          }
        />
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" onPress={onClose}>
          {t('pairByCode.done.close')}
        </Button>
        <Button onPress={onBack}>{t('pairByCode.backToList')}</Button>
      </Modal.Footer>
    </>
  )
}
