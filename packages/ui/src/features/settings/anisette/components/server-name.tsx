import { useTranslation } from 'react-i18next'

import { TAG_CLASS } from '@ui/features/settings/anisette/constants.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

type ServerNameProps = {
  server: AnisetteServerEntry
  /** "In use" (Automatic) or "Chosen" (picked by the user), filled in the accent colour. */
  markKey:
    | 'settings.anisette.tag.inUse'
    | 'settings.anisette.tag.chosen'
    | undefined
}

/** A server's name, its tags, and its address under it. */
export const ServerName = ({ server, markKey }: ServerNameProps) => {
  const { t } = useTranslation()

  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-medium">{server.name}</span>
      {server.source === 'custom' ? (
        <span className={`${TAG_CLASS} bg-surface-tertiary text-muted`}>
          {t('settings.anisette.tag.custom')}
        </span>
      ) : null}
      {markKey ? (
        <span className={`${TAG_CLASS} bg-accent text-accent-foreground`}>
          {t(markKey)}
        </span>
      ) : null}
      <span className="w-full break-all font-mono text-muted text-xs">
        {server.address}
      </span>
    </span>
  )
}
