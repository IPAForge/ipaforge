import { Button, Modal, Spinner } from '@heroui/react'
import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionError } from '@ui/features/apps/components/action-error.tsx'
import { PasswordField } from '@ui/features/developer/components/password-field.tsx'
import { P12_FILE_TYPES } from '@ui/features/developer/constants.ts'
import type { PickedFile, PortalContext } from '@ui/features/developer/types.ts'
import { useCertificateTransfer } from '@ui/hooks/queries/use-certificate-transfer.ts'

type ImportCertificateDialogProps = {
  context: PortalContext
  onClose: () => void
}

/**
 * Imports a .p12 from another computer or SideStore with its password: IPAForge checks Apple still lists its
 * certificate for the team, then signs with it here (no new certificate, no slot used).
 */
export const ImportCertificateDialog = ({
  context,
  onClose
}: ImportCertificateDialogProps) => {
  const { t } = useTranslation()
  const { importP12 } = useCertificateTransfer(context.query)
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<PickedFile>()
  const [password, setPassword] = useState('')
  const onChoose = () => input.current?.click()
  const onPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    importP12.reset()
    setFile({
      name: picked.name,
      bytes: new Uint8Array(await picked.arrayBuffer())
    })
  }
  const onPickedChange = (event: ChangeEvent<HTMLInputElement>) =>
    void onPicked(event)
  const onPassword = (value: string) => {
    setPassword(value)
    importP12.reset()
  }
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || importP12.isPending)) onClose()
  }
  const onImport = () => {
    if (file && password)
      importP12.mutate({ bytes: file.bytes, password }, { onSuccess: onClose })
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t('portal.importDialog.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3 text-sm">
              <p>{t('portal.importDialog.body')}</p>
              <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                <span
                  className={`min-w-0 flex-1 break-all ${file ? 'font-semibold' : 'text-muted'}`}
                >
                  {file?.name ?? t('portal.importDialog.noFile')}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={onChoose}
                  isDisabled={importP12.isPending}
                >
                  {t('portal.importDialog.choose')}
                </Button>
                <input
                  ref={input}
                  type="file"
                  accept={P12_FILE_TYPES}
                  className="hidden"
                  aria-label={t('portal.importDialog.choose')}
                  onChange={onPickedChange}
                />
              </div>
              <PasswordField
                label={t('portal.importDialog.password')}
                value={password}
                isReadOnly={importP12.isPending}
                onChange={onPassword}
              />
              <ActionError error={importP12.error} />
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={onClose}
                isDisabled={importP12.isPending}
              >
                {t('prompts.cancel')}
              </Button>
              <Button
                onPress={onImport}
                isDisabled={!(file && password)}
                isPending={importP12.isPending}
              >
                {importP12.isPending ? (
                  <Spinner size="sm" color="current" />
                ) : null}
                {t('portal.importDialog.import')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
