import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PortalContext } from '@ui/features/developer/types.ts'
import { useDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { useInstalledApps } from '@ui/hooks/queries/use-installed-apps.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'

const NO_TEAMS: readonly never[] = []

/**
 * What the Developer Portal shows things for: the Apple ID in use and one of its teams (the first, until another
 * is chosen), the device in use, and its apps signed by the Apple ID's teams.
 */
export const usePortalContext = (): PortalContext => {
  const { t } = useTranslation()
  const account = useActiveAccount()
  const device = useDeviceInUse()
  const isConnected = device?.isConnected ?? false
  const status = useDeviceStatus(device?.udid, isConnected).data
  const teamsAnswer = useTeams(account?.id).data
  const teams = teamsAnswer?.kind === 'teams' ? teamsAnswer.teams : NO_TEAMS
  const [teamId, setTeamId] = useState<string>()
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0]
  const installed = useInstalledApps(
    device?.udid,
    teams.map((candidate) => candidate.id),
    isConnected
  )

  return {
    account,
    teams,
    team,
    query:
      account && team ? { accountId: account.id, teamId: team.id } : undefined,
    canAsk: teamsAnswer?.kind === 'teams',
    device:
      device && isConnected
        ? {
            udid: device.udid,
            name: status?.info.name ?? t('apps.thisDevice')
          }
        : undefined,
    apps: installed.data ?? NO_TEAMS,
    onTeam: setTeamId
  }
}
