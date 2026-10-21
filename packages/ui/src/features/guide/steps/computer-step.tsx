import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { CheckRow } from '@ui/features/guide/components/check-row.tsx'
import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { ServiceFix } from '@ui/features/guide/components/service-fix.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { computerChecks } from '@ui/features/guide/utils/computer-checks.ts'
import { hostSystem } from '@ui/features/guide/utils/host-system.ts'
import { useSystemCheck } from '@ui/hooks/queries/use-system-check.ts'

/**
 * This computer: Apple's servers, the clock and the anisette server sign-in would use, and the system service that
 * talks to iPhones when it's missing (with the fix for this system). Check again reads them again.
 */
export const ComputerStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()
  const check = useSystemCheck()
  const data = check.isFetching ? undefined : check.data
  const system = hostSystem(globalThis.navigator?.userAgent ?? '')
  const checks = computerChecks(t, data, system)
  const isReady = checks.every((row) => row.state === 'ok')
  // The iPhone connection service is only worth a row when it's missing (Windows without Apple Devices, Linux
  // without usbmuxd): while it's checked or when it answers there's nothing to say, so it never flashes by.
  const shown = checks.filter(
    (row) => row.id !== 'service' || row.state === 'problem'
  )
  const onRecheck = () => void check.refetch()

  return (
    <>
      <StepHeader
        titleKey="guide.computer.title"
        leadKey="guide.computer.lead"
      />
      {check.error ? (
        <p className="text-danger text-sm" role="status">
          {t('guide.computer.failed')}
        </p>
      ) : null}
      <ul
        aria-label={t('guide.computer.title')}
        className="flex flex-col gap-2"
      >
        {shown.map((row) => (
          <CheckRow
            key={row.id}
            state={row.state}
            title={row.title}
            action={
              row.id === 'service' && row.state === 'problem' ? (
                <ServiceFix system={system} />
              ) : undefined
            }
          >
            {row.text}
          </CheckRow>
        ))}
      </ul>
      <GuideNav
        onBack={nav.onBack}
        onSkip={nav.onSkip}
        onNext={nav.onContinue}
        nextLabel={t('guide.continue')}
        isNextDisabled={!isReady}
        extra={
          <Button
            variant="secondary"
            onPress={onRecheck}
            isPending={check.isFetching}
          >
            {t('guide.checkAgain')}
          </Button>
        }
      />
    </>
  )
}
