import { Button, Modal, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { LocalNetworkNotice } from '@ui/features/devices/components/local-network-notice.tsx'
import { NotFoundHelp } from '@ui/features/devices/pair/components/not-found-help.tsx'
import { PairHeader } from '@ui/features/devices/pair/components/pair-header.tsx'
import { PairableList } from '@ui/features/devices/pair/components/pairable-list.tsx'
import { WhereToOpen } from '@ui/features/devices/pair/components/where-to-open.tsx'
import type { PairableSearch } from '@ui/features/devices/pair/types.ts'
import { searchStatusKey } from '@ui/features/devices/pair/utils/search-status.ts'
import type { PairableDevice } from '@ui/services/engine/types.ts'

type FindStepProps = {
  title: string
  search: PairableSearch
  onPair: (device: PairableDevice) => void
  onClose: () => void
}

/**
 * Step 1: where to open the pairing screen on each kind of device, the devices showing it as the search finds
 * them, and what to check when one doesn't show up.
 */
export const FindStep = ({ title, search, onPair, onClose }: FindStepProps) => {
  const { t } = useTranslation()

  return (
    <>
      <PairHeader title={title} step="find" />
      <Modal.Body className="flex flex-col gap-3">
        <p className="text-muted text-sm">{t('pairByCode.intro')}</p>
        <WhereToOpen />
        <LocalNetworkNotice isDenied={search.isDenied} />
        {search.devices.length > 0 ? (
          <PairableList devices={search.devices} onPair={onPair} />
        ) : null}
        {search.isDenied ? null : (
          <p
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-border border-dashed px-3.5 py-3 text-muted text-sm"
          >
            {search.hasFailed ? null : <Spinner size="sm" />}
            {t(searchStatusKey(search))}
          </p>
        )}
        <NotFoundHelp />
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button variant="tertiary" onPress={onClose}>
          {t('prompts.cancel')}
        </Button>
      </Modal.Footer>
    </>
  )
}
