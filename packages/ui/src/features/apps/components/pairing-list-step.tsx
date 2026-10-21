import { Button, Modal, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { ActionError } from '@ui/features/apps/components/action-error.tsx'
import { PairingRow } from '@ui/features/apps/components/pairing-row.tsx'
import type { usePairingFiles } from '@ui/hooks/queries/use-pairing-files.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

type PairingListStepProps = {
  files: ReturnType<typeof usePairingFiles>
  focus: string | undefined
  /** The app whose file is being placed now. */
  placing: string | undefined
  isBusy: boolean
  error: unknown
  onPlace: (app: AppPairing) => void
  onRemove: (app: AppPairing) => void
  onNewRemote: () => void
  onClose: () => void
}

/** The apps with their pairing files, what a pairing file is for, and a new remote pairing when an app reads one. */
export const PairingListStep = ({
  files,
  focus,
  placing,
  isBusy,
  error,
  onPlace,
  onRemove,
  onNewRemote,
  onClose
}: PairingListStepProps) => {
  const { t } = useTranslation()
  const apps = files.data ?? []
  const readsRemote = apps.some((app) => app.remote !== undefined)

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{t('apps.pairing.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3">
        <p className="text-muted text-sm">{t('apps.pairing.hint')}</p>
        <ActionError error={files.error ?? error} />
        {files.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" aria-label={t('apps.pairing.reading')} />
          </div>
        ) : null}
        {files.data && apps.length === 0 ? (
          <p className="text-muted text-sm">{t('apps.pairing.empty')}</p>
        ) : null}
        {apps.length > 0 ? (
          <ul
            aria-label={t('apps.pairing.title')}
            className="flex flex-col gap-2"
          >
            {apps.map((app) => (
              <PairingRow
                key={app.bundleId}
                app={app}
                isFocused={app.bundleId === focus}
                isPlacing={app.bundleId === placing}
                isBusy={isBusy}
                onPlace={onPlace}
                onRemove={onRemove}
              />
            ))}
          </ul>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-between gap-2">
        {readsRemote ? (
          <Button variant="tertiary" onPress={onNewRemote} isDisabled={isBusy}>
            {t('apps.pairing.newRemote')}
          </Button>
        ) : (
          <span />
        )}
        <Button onPress={onClose} isDisabled={isBusy}>
          {t('apps.pairing.done')}
        </Button>
      </Modal.Footer>
    </>
  )
}
