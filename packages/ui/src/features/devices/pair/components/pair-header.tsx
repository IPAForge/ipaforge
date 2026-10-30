import { Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { progressClasses } from '@ui/features/devices/pair/constants.ts'

type PairHeaderProps = {
  title: string
  /** Finding the device, or its code (and what follows). */
  step: 'find' | 'code'
}

/** The dialog's two steps, the current one filled in, and the step's title. */
export const PairHeader = ({ title, step }: PairHeaderProps) => {
  const { t } = useTranslation()
  const classesFor = (current: boolean) =>
    current ? progressClasses.current : progressClasses.other

  return (
    <Modal.Header className="flex flex-col items-start gap-2">
      <ol
        aria-label={t('pairByCode.progress.label')}
        className="flex flex-wrap gap-1.5 text-xs"
      >
        <li
          aria-current={step === 'find' ? 'step' : undefined}
          className={classesFor(step === 'find')}
        >
          {t('pairByCode.progress.find')}
        </li>
        <li
          aria-current={step === 'code' ? 'step' : undefined}
          className={classesFor(step === 'code')}
        >
          {t('pairByCode.progress.code')}
        </li>
      </ol>
      <Modal.Heading className="text-balance">{title}</Modal.Heading>
    </Modal.Header>
  )
}
