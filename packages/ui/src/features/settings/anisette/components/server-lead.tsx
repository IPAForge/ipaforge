import { RadioButton, RadioField } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { ServerName } from '@ui/features/settings/anisette/components/server-name.tsx'
import { LEAD_CLASS } from '@ui/features/settings/anisette/constants.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

type ServerLeadProps = {
  server: AnisetteServerEntry
  /** Where Automatic tries it (1 first); undefined when the user picks a server, which shows a radio instead. */
  position: number | undefined
  markKey:
    | 'settings.anisette.tag.inUse'
    | 'settings.anisette.tag.chosen'
    | undefined
}

/**
 * A server's place in Automatic's order and its name; when the user picks a server, a radio instead of the place,
 * and the whole name selects it.
 */
export const ServerLead = ({ server, position, markKey }: ServerLeadProps) => {
  const { t } = useTranslation()
  const name = <ServerName server={server} markKey={markKey} />

  if (position !== undefined)
    return (
      <div className={LEAD_CLASS}>
        <span
          className="grid size-6 place-items-center rounded-full bg-surface-tertiary text-muted text-xs tabular-nums"
          aria-label={t('settings.anisette.position', { position })}
          role="img"
        >
          {position}
        </span>
        {name}
      </div>
    )

  return (
    <RadioField
      value={server.address}
      className="min-w-0"
      aria-label={t('settings.anisette.use', { name: server.name })}
    >
      <RadioButton className={`${LEAD_CLASS} cursor-pointer`}>
        {({ isSelected, isFocusVisible }) => (
          <>
            <span
              aria-hidden="true"
              className={`grid size-[18px] place-items-center rounded-full border-2 ${isSelected ? 'border-accent' : 'border-border'} ${isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''}`}
            >
              {isSelected ? (
                <span className="size-2 rounded-full bg-accent" />
              ) : null}
            </span>
            {name}
          </>
        )}
      </RadioButton>
    </RadioField>
  )
}
