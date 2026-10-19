import { useChecklistTicks } from '@ui/features/devices/checklist/hooks/use-checklist-ticks.ts'
import { useDeviceApps } from '@ui/features/devices/checklist/hooks/use-device-apps.ts'
import { checklistItems } from '@ui/features/devices/checklist/utils/checklist-items.ts'
import { checklistProgress } from '@ui/features/devices/checklist/utils/checklist-progress.ts'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { isSideStore } from '@ui/features/repair/utils/is-sidestore.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'
import { useInstalledApps } from '@ui/hooks/queries/use-installed-apps.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useActiveAccount } from '@ui/hooks/use-selection.ts'

const NO_TEAMS: readonly string[] = []

/**
 * A device's checklist: its lines from what IPAForge sees (its status, the apps your teams signed, LocalDevVPN)
 * and what you ticked, how far along it is, and how to tick.
 */
export const useDeviceChecklist = (
  udid: string,
  device: ListedDevice | undefined
) => {
  const view = useDeviceView(udid, device)
  const account = useActiveAccount()
  const teams = useTeams(account?.id).data
  const teamIds =
    teams?.kind === 'teams' ? teams.teams.map((team) => team.id) : NO_TEAMS
  const isConnected = device !== undefined
  const isTrusted = view.state !== 'notTrusted' && view.check !== undefined
  const installed = useInstalledApps(udid, teamIds, isConnected && isTrusted)
  const apps = useDeviceApps(udid, isConnected && isTrusted)
  const { ticked, tick } = useChecklistTicks(udid)
  const version = view.check?.info.productVersion
  const items = checklistItems({
    iosMajor: version ? Number(version.split('.')[0]) : undefined,
    isConnected,
    isTrusted,
    isLocked: view.check?.locked ?? false,
    developerMode: view.check?.developerMode,
    hasInstalled: (installed.data?.length ?? 0) > 0,
    hasSideStore: (installed.data ?? []).some((app) =>
      isSideStore(app.bundleId)
    ),
    hasLocalDevVpn: apps.data?.localDevVpn ?? false,
    ticked
  })

  return {
    view,
    version,
    items,
    progress: checklistProgress(items),
    tick
  }
}
