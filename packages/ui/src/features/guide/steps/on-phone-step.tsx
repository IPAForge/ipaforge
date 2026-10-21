import { useTranslation } from 'react-i18next'

import { ChecklistLine } from '@ui/features/devices/checklist/components/checklist-line.tsx'
import { checklistGroups } from '@ui/features/devices/checklist/constants.ts'
import { useDeviceChecklist } from '@ui/features/devices/checklist/hooks/use-device-checklist.ts'
import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { ON_PHONE_GROUPS } from '@ui/features/guide/constants.ts'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'

/**
 * On your iPhone: what only you can do there once SideStore is on it (trust your Apple ID as a developer,
 * LocalDevVPN, SideStore itself), the Devices page's checklist lines, ticked in the same place.
 */
export const OnPhoneStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()
  const inUse = useDeviceInUse()
  const account = useActiveAccount()
  const { view, items, tick } = useDeviceChecklist(
    inUse?.udid ?? '',
    inUse?.device
  )

  return (
    <>
      <StepHeader titleKey="guide.onphone.title" leadKey="guide.onphone.lead" />
      {inUse
        ? ON_PHONE_GROUPS.map((group) => {
            const inGroup = items.filter((item) => item.group === group)
            if (inGroup.length === 0) return null

            return (
              <section
                key={group}
                aria-label={t(checklistGroups[group])}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <h2 className="bg-surface-secondary px-4 py-1.5 text-muted text-xs uppercase tracking-wide">
                  {t(checklistGroups[group])}
                </h2>
                <ul className="divide-y divide-border">
                  {inGroup.map((item) => (
                    <ChecklistLine
                      key={item.id}
                      item={item}
                      udid={inUse.udid}
                      device={view.name}
                      appleId={account?.appleId ?? ''}
                      onTick={tick}
                    />
                  ))}
                </ul>
              </section>
            )
          })
        : null}
      <GuideNav
        onBack={nav.onBack}
        onSkip={nav.onSkip}
        onNext={nav.onContinue}
        nextLabel={t('guide.continue')}
      />
    </>
  )
}
