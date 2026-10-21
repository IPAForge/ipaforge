import { useTranslation } from 'react-i18next'

import { RowChip } from '@ui/features/preload/home/components/row-chip.tsx'
import type { InstallPlan } from '@ui/services/engine/types.ts'

type InstallChipsProps = {
  plan: InstallPlan
  isPairingApp: boolean
}

/** What installing an app does on the device: new or an update, and the pairing file for a pairing app. */
export const InstallChips = ({ plan, isPairingApp }: InstallChipsProps) => {
  const { t } = useTranslation()

  return (
    <>
      {plan.installedVersion ? (
        <RowChip tone="accent">
          {t('preload.row.updates', {
            from: plan.installedVersion,
            to: plan.inspection.app.version ?? ''
          })}
        </RowChip>
      ) : (
        <RowChip>{t('preload.row.new')}</RowChip>
      )}
      {isPairingApp ? (
        <RowChip tone="accent">{t('preload.row.pairing')}</RowChip>
      ) : null}
    </>
  )
}
