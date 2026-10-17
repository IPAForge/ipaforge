import { useTranslation } from 'react-i18next'

import { useDeviceView } from '@ui/features/devices/use-device-view.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import type {
  DeviceCheck,
  InstallSideStoreInput
} from '@ui/services/engine/engine-types.ts'

export type RunTarget = {
  readonly app: string
  readonly channel: string
  readonly deviceName: string
  readonly check?: DeviceCheck | undefined
  readonly appleId: string
}

/** What a run installs, and where: the names its header, summary and banners show. */
export const useRunTarget = (input: InstallSideStoreInput): RunTarget => {
  const { t } = useTranslation()
  const device = useDevices().data?.find(
    (candidate) => candidate.udid === input.udid
  )
  const deviceView = useDeviceView(input.udid, device)
  const account = useAccounts().data?.find(
    (candidate) => candidate.id === input.accountId
  )

  return {
    app: t(`install.variant.${input.variant}.title`),
    channel: t(`install.channel.${input.channel ?? 'stable'}`),
    deviceName: deviceView.name,
    check: deviceView.check,
    appleId: account?.appleId ?? input.accountId
  }
}
