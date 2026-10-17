import { Button } from '@heroui/react'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { useAccountView } from '@ui/features/accounts/use-account-view.ts'
import { useDeviceView } from '@ui/features/devices/use-device-view.ts'
import { BlockedNotice } from '@ui/features/install/blocked-notice.tsx'
import { DeviceInUseNotice } from '@ui/features/install/device-in-use-notice.tsx'
import { ChannelChoice } from '@ui/features/install/home/channel-choice.tsx'
import { installReadiness } from '@ui/features/install/home/readiness.ts'
import { ThisInstall } from '@ui/features/install/home/this-install.tsx'
import { VariantChoice } from '@ui/features/install/home/variant-choice.tsx'
import { SignInNeededNotice } from '@ui/features/install/sign-in-needed-notice.tsx'
import { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import { useRecommendedChannel } from '@ui/hooks/queries/use-recommended-channel.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import {
  useActiveAccount,
  useDeviceInUse,
  useDevicesInUse
} from '@ui/hooks/use-selection.ts'
import {
  type Channel,
  type SideStoreVariant,
  variantAppId
} from '@ui/services/engine/engine-types.ts'

/**
 * The Install page before a run: what to fix first (the device, the Apple ID), what to install and from which
 * channel, what this install uses, and Install.
 */
export const InstallHome = () => {
  const { t } = useTranslation()
  const { start } = useRun()
  const [variant, setVariant] = useState<SideStoreVariant>('sidestore')
  const [picked, setPicked] = useState<Channel | undefined>(undefined)
  const inUse = useDeviceInUse()
  const account = useActiveAccount()
  const deviceView = useDeviceView(inUse?.udid, inUse?.device)
  const accountView = useAccountView(account, useDevicesInUse())
  const recommended = useRecommendedChannel(
    variantAppId[variant],
    deviceView.check?.info.productVersion
  ).data
  const channel = picked ?? recommended ?? 'stable'
  const canPlan =
    inUse !== undefined &&
    account !== undefined &&
    deviceView.state === 'ready' &&
    (accountView.state === 'ready' || accountView.state === 'checking')
  const plan = usePlanInstall(
    canPlan
      ? {
          udid: inUse.udid,
          accountId: account.id,
          source: { kind: 'catalog', appId: variantAppId[variant], channel }
        }
      : undefined
  )
  const readiness = installReadiness(
    deviceView.state,
    accountView.state,
    plan.data?.appIds.enough ?? true
  )
  const app = t(`install.variant.${variant}.title`)
  const onInstall = () => {
    if (!inUse || !account) return
    start({ udid: inUse.udid, accountId: account.id, variant, channel })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titleKey="install.title"
        descriptionKey="install.description"
      />
      <DeviceInUseNotice />
      <BlockedNotice />
      <SignInNeededNotice />
      <VariantChoice value={variant} onChange={setVariant} />
      <ChannelChoice
        value={channel}
        recommended={recommended}
        onChange={setPicked}
      />
      <ThisInstall plan={plan} isWaiting={!canPlan} app={app} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" isDisabled={!readiness.isReady} onPress={onInstall}>
          <Download aria-hidden="true" className="size-4" />
          {t('install.home.install', { app })}
        </Button>
        <span className="text-muted text-sm">{t(readiness.reasonKey)}</span>
      </div>
    </div>
  )
}
