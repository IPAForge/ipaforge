import { Modal } from '@heroui/react'
import { useState } from 'react'

import { AddPairingStep } from '@ui/features/apps/components/add-pairing-step.tsx'
import { NewRemoteStep } from '@ui/features/apps/components/new-remote-step.tsx'
import { PairingListStep } from '@ui/features/apps/components/pairing-list-step.tsx'
import { RemovePairingStep } from '@ui/features/apps/components/remove-pairing-step.tsx'
import { PAIRING_LIST } from '@ui/features/apps/constants.ts'
import type { PairingStep } from '@ui/features/apps/types.ts'
import { usePairingActions } from '@ui/hooks/queries/use-pairing-actions.ts'
import { usePairingFiles } from '@ui/hooks/queries/use-pairing-files.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

type PairingFilesDialogProps = {
  udid: string
  teamIds: readonly string[]
  /** The app the dialog was opened for (its row's tag), highlighted in the list. */
  focus: string | undefined
  onClose: () => void
}

/**
 * Pairing files: every pairing app and other app IPAForge installed on the device, with whose pairing files each
 * holds, and Place, Remove and a new remote pairing for SideStore. Adding one to your own app asks where; removing
 * and a new remote pairing ask first; each comes back to the list.
 */
export const PairingFilesDialog = ({
  udid,
  teamIds,
  focus,
  onClose
}: PairingFilesDialogProps) => {
  const [step, setStep] = useState<PairingStep>(PAIRING_LIST)
  const files = usePairingFiles(udid, teamIds, true)
  const actions = usePairingActions(udid, teamIds)
  const isBusy =
    actions.place.isPending ||
    actions.remove.isPending ||
    actions.newRemote.isPending
  const onBack = () => {
    actions.place.reset()
    actions.remove.reset()
    actions.newRemote.reset()
    setStep(PAIRING_LIST)
  }
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || isBusy)) onClose()
  }
  const onPlace = (app: AppPairing) => {
    if (app.kind === 'own') setStep({ kind: 'add', app })
    else actions.place.mutate({ bundleId: app.bundleId })
  }
  const onRemove = (app: AppPairing) => setStep({ kind: 'remove', app })
  const onNewRemote = () => setStep({ kind: 'newRemote' })
  const onAdd = (app: AppPairing, path: string) =>
    actions.place.mutate(
      { bundleId: app.bundleId, path },
      { onSuccess: onBack }
    )
  const onConfirmRemove = (app: AppPairing) =>
    actions.remove.mutate(app.bundleId, { onSuccess: onBack })
  const onConfirmNewRemote = () =>
    actions.newRemote.mutate(undefined, { onSuccess: onBack })

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-2xl">
            {step.kind === 'list' ? (
              <PairingListStep
                files={files}
                focus={focus}
                placing={
                  actions.place.isPending
                    ? actions.place.variables.bundleId
                    : undefined
                }
                isBusy={isBusy}
                error={actions.place.error}
                onPlace={onPlace}
                onRemove={onRemove}
                onNewRemote={onNewRemote}
                onClose={onClose}
              />
            ) : null}
            {step.kind === 'add' ? (
              <AddPairingStep
                app={step.app}
                isPending={actions.place.isPending}
                error={actions.place.error}
                onAdd={onAdd}
                onBack={onBack}
              />
            ) : null}
            {step.kind === 'remove' ? (
              <RemovePairingStep
                app={step.app}
                isPending={actions.remove.isPending}
                error={actions.remove.error}
                onConfirm={onConfirmRemove}
                onBack={onBack}
              />
            ) : null}
            {step.kind === 'newRemote' ? (
              <NewRemoteStep
                isPending={actions.newRemote.isPending}
                error={actions.newRemote.error}
                onConfirm={onConfirmNewRemote}
                onBack={onBack}
              />
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
