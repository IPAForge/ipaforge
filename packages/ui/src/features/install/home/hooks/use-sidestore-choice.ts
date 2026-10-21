import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAccountView } from '@ui/features/accounts/hooks/use-account-view.ts'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { installReadiness } from '@ui/features/install/home/utils/readiness.ts'
import { planInput } from '@ui/features/install/utils/plan-input.ts'
import { usePlanInstall } from '@ui/hooks/queries/use-plan-install.ts'
import { useRecommendedChannel } from '@ui/hooks/queries/use-recommended-channel.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import {
  useActiveAccount,
  useDeviceInUse,
  useDevicesInUse
} from '@ui/hooks/use-selection.ts'
import { variantAppId } from '@ui/services/engine/constants.ts'
import type { Channel, SideStoreVariant } from '@ui/services/engine/types.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

/**
 * What a SideStore install would be (the Install page's and the setup guide's): SideStore or LiveContainer, the
 * channel (the recommended one until another is picked), the Engine's plan, whether it can start and why not, and
 * starting it, with a team when one was picked.
 */
export const useSideStoreChoice = () => {
  const { t } = useTranslation()
  const { run, start } = useRun()
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
      ? planInput({ udid: inUse.udid, accountId: account.id, variant, channel })
      : undefined
  )
  const readiness = installReadiness(
    deviceView.state,
    accountView.state,
    plan.data?.appIds.enough ?? true
  )
  const onInstall = (teamId?: string) => {
    if (!inUse || !account) return
    start({
      udid: inUse.udid,
      accountId: account.id,
      variant,
      channel,
      ...(teamId ? { teamId } : {})
    })
  }

  return {
    variant,
    setVariant,
    channel,
    recommended,
    setPicked,
    plan,
    canPlan,
    readiness,
    canInstall: readiness.isReady && !isRunActive(run?.view),
    app: t(`install.variant.${variant}.title`),
    onInstall
  }
}
