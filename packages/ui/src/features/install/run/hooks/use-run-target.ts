import { useTranslation } from 'react-i18next'

import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import type { RunTarget } from '@ui/features/install/run/types.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

/** What a run installs, and where: the names its header, summary and banners show. */
export const useRunTarget = (run: ActiveRun): RunTarget => {
  const { t } = useTranslation()
  const { list } = useFormat()
  const { udid, accountId } = run.input
  const device = useDevices().data?.find((candidate) => candidate.udid === udid)
  const deviceView = useDeviceView(udid, device)
  const account = useAccounts().data?.find(
    (candidate) => candidate.id === accountId
  )
  const where = {
    deviceName: deviceView.name,
    check: deviceView.check,
    appleId: account?.appleId ?? accountId
  }

  return run.kind === 'sidestore'
    ? {
        kind: run.repair ? 'repair' : run.kind,
        app: t(`install.variant.${run.input.variant}.title`),
        count: 1,
        channel: t(`install.channel.${run.input.channel ?? 'stable'}`),
        ...where
      }
    : {
        kind: run.kind,
        app: list(run.apps.map((app) => app.name)),
        count: run.apps.length,
        channel: undefined,
        ...where
      }
}
