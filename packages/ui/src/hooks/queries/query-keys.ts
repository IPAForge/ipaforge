// Every Engine query's cache key, in one place: invalidating `accounts` refreshes an account's teams, quota and
// certificates too, because their keys start with it.
import type { LogFilter } from '@ipaforge/kernel'
import type { RemotePlanInstallInput, TeamQuery } from '@ipaforge/rpc'

const teamKey = ({ accountId, teamId }: TeamQuery) =>
  ['accounts', accountId, 'team', teamId ?? null] as const

export const queryKeys = {
  devices: ['devices'] as const,
  deviceStatus: (udid: string | undefined) =>
    ['devices', udid ?? null, 'status'] as const,
  accounts: ['accounts'] as const,
  canSaveAccounts: ['accounts', 'can-save'] as const,
  /** Every query about one account (its teams, quota, certificates). */
  account: (accountId: string) => ['accounts', accountId] as const,
  teams: (accountId: string | undefined) =>
    ['accounts', accountId ?? null, 'teams'] as const,
  catalogApps: ['catalog', 'apps'] as const,
  /** Every query about app sources: the list and their apps. */
  sources: ['sources'] as const,
  sourceList: ['sources', 'list'] as const,
  sourceApps: ['sources', 'apps'] as const,
  /** Every query about installed apps (refreshed when a run ends). */
  apps: ['installed-apps'] as const,
  installedApps: (udid: string | undefined, teamIds: readonly string[]) =>
    ['installed-apps', udid ?? null, teamIds.join(',')] as const,
  /** Repair SideStore's check; under `apps`, so it's read again when a run ends. */
  sideStoreCheck: (udid: string | undefined, accountId: string | undefined) =>
    ['installed-apps', 'sidestore', udid ?? null, accountId ?? null] as const,
  catalogReleases: (appId: string) => ['catalog', appId, 'releases'] as const,
  recommendedChannel: (appId: string, iosVersion: string | undefined) =>
    ['catalog', appId, 'channel', iosVersion ?? null] as const,
  appIdQuota: (query: TeamQuery | undefined) =>
    query ? ([...teamKey(query), 'appIdQuota'] as const) : ['idle'],
  certificates: (query: TeamQuery | undefined) =>
    query ? ([...teamKey(query), 'certificates'] as const) : ['idle'],
  planInstall: (input: RemotePlanInstallInput | undefined) =>
    ['plan', input ?? null] as const,
  /** Pages of the Engine's log buffer for one filter; never cached between visits to Logs. */
  logs: (filter: LogFilter) => ['logs', 'lines', filter] as const,
  logLevel: ['logs', 'level'] as const
}
