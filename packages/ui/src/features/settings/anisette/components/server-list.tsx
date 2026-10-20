import { RadioGroup } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { ServerRow } from '@ui/features/settings/anisette/components/server-row.tsx'
import { groupLabelKeys } from '@ui/features/settings/anisette/constants.ts'
import type { ServerTests } from '@ui/features/settings/anisette/types.ts'
import { markKeyFor } from '@ui/features/settings/anisette/utils/mark-key.ts'
import { serverKey } from '@ui/features/settings/anisette/utils/server-form-problems.ts'
import { serverGroups } from '@ui/features/settings/anisette/utils/server-groups.ts'
import type {
  AnisetteOverview,
  AnisetteServerEntry
} from '@ui/services/engine/types.ts'

type ServerListProps = {
  overview: AnisetteOverview
  tests: ServerTests
  removing: string | undefined
  onChoose: (server: AnisetteServerEntry) => void
  onEdit: (server: AnisetteServerEntry) => void
  onRemove: (address: string) => void
}

/**
 * The servers by group, in the order Automatic tries them, numbered; when the user picks a server, a radio list
 * instead.
 */
export const ServerList = ({
  overview,
  tests,
  removing,
  onChoose,
  onEdit,
  onRemove
}: ServerListProps) => {
  const { t } = useTranslation()
  const isChoosing = overview.choice.mode === 'chosen'
  const chosen =
    overview.choice.mode === 'chosen' ? overview.choice.server : undefined
  const groups = serverGroups(overview.servers)
  const onChange = (address: string) => {
    const server = overview.servers.find(
      (candidate) => candidate.address === address
    )
    if (server) onChoose(server)
  }
  let position = 0

  const list = (
    <ul className="overflow-hidden rounded-2xl border border-border">
      {groups.map((group) => (
        <li key={group.source}>
          <p className="border-border border-t bg-surface-secondary px-3.5 py-2 text-muted text-xs uppercase tracking-wide">
            {t(groupLabelKeys[group.source])}
          </p>
          <ul>
            {group.servers.map((server) => {
              position += 1
              const isSelected =
                chosen !== undefined &&
                serverKey(chosen.address) === serverKey(server.address)

              return (
                <ServerRow
                  key={server.address}
                  server={server}
                  position={isChoosing ? undefined : position}
                  markKey={markKeyFor(overview, server, isSelected)}
                  isSelected={isSelected}
                  test={tests.states[server.address]}
                  isRemoving={removing === server.address}
                  onTest={tests.test}
                  onEdit={onEdit}
                  onRemove={onRemove}
                />
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )

  if (!isChoosing) return list

  return (
    <RadioGroup
      aria-label={t('settings.anisette.chooseLabel')}
      value={chosen?.address ?? null}
      onChange={onChange}
    >
      {list}
    </RadioGroup>
  )
}
