import { useTranslation } from 'react-i18next'

import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { ChannelChoice } from '@ui/features/install/home/components/channel-choice.tsx'
import { DeviceInUseNotice } from '@ui/features/install/home/components/device-in-use-notice.tsx'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { ThisInstall } from '@ui/features/install/home/components/this-install.tsx'
import { VariantChoice } from '@ui/features/install/home/components/variant-choice.tsx'
import { useSideStoreChoice } from '@ui/features/install/home/hooks/use-sidestore-choice.ts'
import { RunView } from '@ui/features/install/run/run-view.tsx'
import { useGuide } from '@ui/hooks/use-guide.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

/**
 * Install SideStore: SideStore or LiveContainer with it, the channel and what the install uses, with the team the
 * Apple ID step picked; or Not now. Once started, the run as on the Install page (its questions, progress, and the
 * fixes when it fails); Continue once it's done.
 */
export const InstallStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()
  const { guide } = useGuide()
  const { run } = useRun()
  const choice = useSideStoreChoice()
  const onInstall = () => choice.onInstall(guide.teamId)
  // Nothing installed, so nothing to do on the iPhone either: straight to the last step.
  const onNotNow = () => nav.onGoTo('around')

  if (run?.kind === 'sidestore') {
    const isActive = isRunActive(run.view)

    return (
      <>
        <RunView run={run} />
        <GuideNav
          onBack={isActive ? undefined : nav.onBack}
          onSkip={isActive ? undefined : nav.onSkip}
          onNext={nav.onContinue}
          nextLabel={t('guide.continue')}
          isNextDisabled={run.view.status !== 'completed'}
        />
      </>
    )
  }

  return (
    <>
      <StepHeader titleKey="guide.install.title" leadKey="guide.install.lead" />
      <DeviceInUseNotice />
      <SignInNeededNotice />
      <VariantChoice value={choice.variant} onChange={choice.setVariant} />
      <ChannelChoice
        value={choice.channel}
        recommended={choice.recommended}
        onChange={choice.setPicked}
      />
      <ThisInstall
        plan={choice.plan}
        isWaiting={!choice.canPlan}
        app={choice.app}
      />
      {choice.canInstall ? null : (
        <p className="text-muted text-sm">{t(choice.readiness.reasonKey)}</p>
      )}
      <GuideNav
        onBack={nav.onBack}
        onSkip={onNotNow}
        skipLabel={t('guide.install.notNow')}
        onNext={onInstall}
        nextLabel={t('install.home.install', { app: choice.app })}
        isNextDisabled={!choice.canInstall}
      />
    </>
  )
}
