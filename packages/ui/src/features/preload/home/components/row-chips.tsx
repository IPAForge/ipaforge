import { Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { InstallChips } from '@ui/features/preload/home/components/install-chips.tsx'
import { RowChip } from '@ui/features/preload/home/components/row-chip.tsx'
import { pairingCatalogApps } from '@ui/features/preload/home/constants.ts'
import type { PreloadRow } from '@ui/features/preload/home/types.ts'

type RowChipsProps = { row: PreloadRow }

/**
 * How far the Engine is with an app, then what installing it means: its App IDs, new or an update, the pairing. An
 * app saved as a signed .ipa says so instead: nothing of it goes on the device.
 */
export const RowChips = ({ row }: RowChipsProps) => {
  const { t } = useTranslation()
  const { status, plan, item } = row
  if (status === 'waiting') return <RowChip>{t('preload.row.waiting')}</RowChip>
  if (status === 'checking' || status === 'downloading')
    return (
      <RowChip>
        <Spinner size="sm" />
        {t(
          status === 'downloading'
            ? 'preload.row.downloading'
            : 'preload.row.checking'
        )}
      </RowChip>
    )
  if (status !== 'ready' || !plan) return null
  const appIds = plan.appIds.create.length + plan.appIds.reuse.length
  const isPairingApp =
    item.source?.kind === 'catalog' && pairingCatalogApps.has(item.source.appId)

  return (
    <>
      <RowChip>
        {t('preload.row.appIds', {
          count: appIds,
          extensions: plan.inspection.nested.length
        })}
      </RowChip>
      {item.save ? (
        <RowChip tone="accent">{t('preload.row.savedOnComputer')}</RowChip>
      ) : (
        <InstallChips plan={plan} isPairingApp={isPairingApp} />
      )}
    </>
  )
}
