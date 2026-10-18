import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { RecoveryAction } from '@loadstar/rpc'
import { FixButton } from '@ui/features/install/recovery/components/fix-button.tsx'
import { FixGuidance } from '@ui/features/install/recovery/components/fix-guidance.tsx'
import { fixes } from '@ui/features/install/recovery/constants.ts'
import type {
  FixHandlers,
  FixLabelValues
} from '@ui/features/install/recovery/types.ts'

type FirstFixProps = {
  action: RecoveryAction
  handlers: FixHandlers
  isPending: boolean
  note?: ReactNode
  labelValues?: FixLabelValues | undefined
}

/** The fix the Engine lists first, as a card: what it is, what to do, and its button. */
export const FirstFix = ({
  action,
  handlers,
  isPending,
  note,
  labelValues
}: FirstFixProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-4 py-3">
      <p className="font-semibold">{t(`recovery.${action}`)}</p>
      <FixGuidance fix={fixes[action]} note={note} />
      <div className="mt-1">
        <FixButton
          action={action}
          handlers={handlers}
          isFirst
          isPending={isPending}
          labelValues={labelValues}
        />
      </div>
    </div>
  )
}
