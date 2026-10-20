import { serverSources } from '@ui/features/settings/anisette/constants.ts'
import type { ServerGroup } from '@ui/features/settings/anisette/types.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

/** The servers by where they come from (added by you, SideStore's list, backup), empty groups left out. */
export const serverGroups = (
  servers: readonly AnisetteServerEntry[]
): ServerGroup[] =>
  serverSources
    .map((source) => ({
      source,
      servers: servers.filter((server) => server.source === source)
    }))
    .filter((group) => group.servers.length > 0)
