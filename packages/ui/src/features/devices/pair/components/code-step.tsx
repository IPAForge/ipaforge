import {
  Button,
  InputOTP,
  Label,
  Modal,
  REGEXP_ONLY_DIGITS
} from '@heroui/react'
import { type SubmitEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PairHeader } from '@ui/features/devices/pair/components/pair-header.tsx'
import type { PairStep } from '@ui/features/devices/pair/types.ts'

type CodeStepProps = {
  step: Extract<PairStep, { phase: 'code' }>
  onAnswer: (code: string) => void
  onBack: () => void
  onClose: () => void
}

/**
 * Step 2: the code the device shows, one box per digit (left to right in every language; a pasted code fills them
 * all). It stays, busy, while the device is reached and while it checks the code; a wrong one says so.
 */
export const CodeStep = ({
  step,
  onAnswer,
  onBack,
  onClose
}: CodeStepProps) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const labelId = useId()
  const name = step.target.name
  const slots = Array.from({ length: step.codeLength }, (_, index) => index)
  const isComplete = code.length === step.codeLength
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isComplete && !step.isPending) onAnswer(code)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      aria-busy={step.isPending}
    >
      <PairHeader title={t('pairByCode.code.title', { name })} step="code" />
      <Modal.Body className="flex flex-col gap-3">
        <p className="text-muted text-sm">
          {t('pairByCode.code.body', { name })}
        </p>
        <Label id={labelId}>{t('pairByCode.code.label')}</Label>
        <div dir="ltr" className="flex justify-center">
          <InputOTP
            aria-labelledby={labelId}
            maxLength={step.codeLength}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            isInvalid={step.retry}
            isDisabled={step.isPending}
            autoFocus
          >
            <InputOTP.Group>
              {slots.map((index) => (
                <InputOTP.Slot key={index} index={index} />
              ))}
            </InputOTP.Group>
          </InputOTP>
        </div>
        {step.retry && !step.isPending ? (
          <p role="alert" className="text-danger-soft-foreground text-sm">
            {t('pairByCode.code.wrong', { name })}
          </p>
        ) : null}
        <p aria-live="polite" className="min-h-5 text-muted text-sm">
          {step.isPending ? t('pairByCode.code.pairing', { name }) : null}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" className="me-auto" onPress={onBack}>
          {t('pairByCode.back')}
        </Button>
        <Button variant="tertiary" onPress={onClose}>
          {t('prompts.cancel')}
        </Button>
        <Button
          type="submit"
          isDisabled={!isComplete}
          isPending={step.isPending}
        >
          {t('pairByCode.pair')}
        </Button>
      </Modal.Footer>
    </form>
  )
}
