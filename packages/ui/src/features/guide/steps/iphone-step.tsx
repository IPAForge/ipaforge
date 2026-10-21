import { useTranslation } from 'react-i18next'

import { ChecklistAction } from '@ui/features/devices/checklist/components/checklist-action.tsx'
import { DeviceNotice } from '@ui/features/devices/components/device-notice.tsx'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { CheckRow } from '@ui/features/guide/components/check-row.tsx'
import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { deviceCheckStates } from '@ui/features/guide/constants.ts'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { useDeviceInUse } from '@ui/hooks/use-selection.ts'

/**
 * Your iPhone: connected over USB, trusting this computer, unlocked, Developer Mode on. What isn't ready says what
 * to do, as on the Devices page (ask for Trust again, show the Developer Mode option, check again).
 */
export const IphoneStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()
  const inUse = useDeviceInUse()
  const view = useDeviceView(inUse?.udid, inUse?.device)
  const isConnected = inUse?.isConnected === true
  const state = view.state ? deviceCheckStates[view.state] : 'waiting'

  return (
    <>
      <StepHeader titleKey="guide.iphone.title" leadKey="guide.iphone.lead" />
      <ul aria-label={t('guide.iphone.title')} className="flex flex-col gap-2">
        {isConnected && inUse ? (
          <CheckRow
            state={state}
            title={view.name}
            action={
              view.state === 'developerModeOff' ? (
                <ChecklistAction action="reveal" udid={inUse.udid} />
              ) : undefined
            }
          >
            {view.stateText}
          </CheckRow>
        ) : (
          <CheckRow state="waiting" title={t('guide.iphone.connectTitle')}>
            {t('guide.iphone.connectText')}
          </CheckRow>
        )}
      </ul>
      {isConnected && inUse ? (
        <DeviceNotice udid={inUse.udid} view={view} />
      ) : null}
      <GuideNav
        onBack={nav.onBack}
        onSkip={nav.onSkip}
        onNext={nav.onContinue}
        nextLabel={t('guide.continue')}
        isNextDisabled={view.state !== 'ready'}
      />
    </>
  )
}
