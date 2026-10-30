import { useTranslation } from 'react-i18next'

import { BackoffStep } from '@ui/features/devices/pair/components/backoff-step.tsx'
import { ClosedStep } from '@ui/features/devices/pair/components/closed-step.tsx'
import { CodeStep } from '@ui/features/devices/pair/components/code-step.tsx'
import { FailedStep } from '@ui/features/devices/pair/components/failed-step.tsx'
import { FindStep } from '@ui/features/devices/pair/components/find-step.tsx'
import { PairShell } from '@ui/features/devices/pair/components/pair-shell.tsx'
import { PairedStep } from '@ui/features/devices/pair/components/paired-step.tsx'
import { usePairByCode } from '@ui/features/devices/pair/hooks/use-pair-by-code.ts'
import { usePairableDevices } from '@ui/features/devices/pair/hooks/use-pairable-devices.ts'
import { useSelection } from '@ui/hooks/use-selection.ts'

type PairDialogProps = {
  /** "Pair again" for a device paired before (after a tvOS or visionOS update): its name, for the title. */
  againName?: string | undefined
  onClose: () => void
}

/**
 * "Pair Apple TV or Vision Pro…": where to open the pairing screen and the devices showing it (1 Find), then the
 * code it shows (2 Code), then the paired device. Mount it only while it is open: the search runs while it's
 * mounted, and unmounting ends a pairing under way.
 */
export const PairDialog = ({ againName, onClose }: PairDialogProps) => {
  const { t } = useTranslation()
  const search = usePairableDevices()
  const pairing = usePairByCode()
  const { select } = useSelection()
  const { step } = pairing
  const onUsePaired = (udid: string) => {
    select('device', udid)
    onClose()
  }
  const findTitle = againName
    ? t('pairByCode.titleAgain', { name: againName })
    : t('pairByCode.title')

  return (
    <PairShell onClose={onClose}>
      {step.phase === 'find' ? (
        <FindStep
          title={findTitle}
          search={search}
          onPair={pairing.start}
          onClose={onClose}
        />
      ) : null}
      {step.phase === 'code' ? (
        <CodeStep
          key={step.count}
          step={step}
          onAnswer={pairing.answer}
          onBack={pairing.back}
          onClose={onClose}
        />
      ) : null}
      {step.phase === 'backoff' ? (
        <BackoffStep
          target={step.target}
          until={step.until}
          onBack={pairing.back}
          onClose={onClose}
        />
      ) : null}
      {step.phase === 'closed' ? (
        <ClosedStep
          target={step.target}
          onBack={pairing.back}
          onClose={onClose}
        />
      ) : null}
      {step.phase === 'failed' ? (
        <FailedStep
          target={step.target}
          error={step.error}
          onBack={pairing.back}
          onClose={onClose}
        />
      ) : null}
      {step.phase === 'done' ? (
        <PairedStep
          paired={step.paired}
          name={step.paired.name ?? t('devices.unknownDevice')}
          onUse={onUsePaired}
          onClose={onClose}
        />
      ) : null}
    </PairShell>
  )
}
