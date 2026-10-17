import { Check } from 'lucide-react'
import { CheckboxButton, CheckboxField } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import type { PairingAppChoice } from '@loadstar/rpc'
import { pairingAppPurposeKey } from '@ui/features/install/prompts/utils/pairing-app-purpose.ts'
import { pairingRowClass } from '@ui/features/install/prompts/utils/pairing-row-class.ts'

type PairingAppRowProps = {
  app: PairingAppChoice
}

/** One app that can take the pairing file: its initial, name and what it does with it, and a tick. */
export const PairingAppRow = ({ app }: PairingAppRowProps) => {
  const { t } = useTranslation()
  const purposeKey = pairingAppPurposeKey(app.bundleId)

  return (
    <CheckboxField value={app.bundleId}>
      <CheckboxButton className={pairingRowClass}>
        {({ isSelected }) => (
          <>
            <span
              aria-hidden="true"
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg font-bold ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-surface-tertiary'}`}
            >
              {app.appName.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{app.appName}</span>
              <span className="truncate text-muted text-xs">
                {purposeKey ? t(purposeKey) : app.bundleId}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-border'}`}
            >
              {isSelected ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : null}
            </span>
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  )
}
