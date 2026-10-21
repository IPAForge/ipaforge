import { Button } from '@heroui/react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { RunElsewhereNotice } from '@ui/components/run-elsewhere-notice.tsx'
import { ChecklistNotice } from '@ui/features/devices/checklist/components/checklist-notice.tsx'
import { BlockedNotice } from '@ui/features/install/home/components/blocked-notice.tsx'
import { ChannelChoice } from '@ui/features/install/home/components/channel-choice.tsx'
import { DeviceInUseNotice } from '@ui/features/install/home/components/device-in-use-notice.tsx'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { ThisInstall } from '@ui/features/install/home/components/this-install.tsx'
import { VariantChoice } from '@ui/features/install/home/components/variant-choice.tsx'
import { useSideStoreChoice } from '@ui/features/install/home/hooks/use-sidestore-choice.ts'

/**
 * The Install page before a run: what to fix first (the device, the Apple ID), what to install and from which
 * channel, what this install uses, and Install.
 */
export const InstallHome = () => {
  const { t } = useTranslation()
  const choice = useSideStoreChoice()
  const onInstall = () => choice.onInstall()

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titleKey="install.title"
        descriptionKey="install.description"
      />
      <RunElsewhereNotice page="sidestore" />
      <DeviceInUseNotice />
      <BlockedNotice />
      <SignInNeededNotice />
      <ChecklistNotice />
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
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" isDisabled={!choice.canInstall} onPress={onInstall}>
          <Download aria-hidden="true" className="size-4" />
          {t('install.home.install', { app: choice.app })}
        </Button>
        <span className="text-muted text-sm">
          {t(choice.readiness.reasonKey)}
        </span>
      </div>
    </div>
  )
}
