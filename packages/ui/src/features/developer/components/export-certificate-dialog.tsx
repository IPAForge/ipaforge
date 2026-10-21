import { Button, Modal, Spinner } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionError } from '@ui/features/apps/components/action-error.tsx'
import { PasswordField } from '@ui/features/developer/components/password-field.tsx'
import { MIN_P12_PASSWORD } from '@ui/features/developer/constants.ts'
import type { PortalContext } from '@ui/features/developer/types.ts'
import { useCertificateTransfer } from '@ui/hooks/queries/use-certificate-transfer.ts'

type ExportCertificateDialogProps = {
  context: PortalContext
  serialNumber: string
  onClose: () => void
}

/**
 * Exports this computer's certificate with its private key as a .p12, under a password typed twice, saved where the
 * user chooses. Says first that the file and its password are enough to sign as the team.
 */
export const ExportCertificateDialog = ({
  context,
  serialNumber,
  onClose
}: ExportCertificateDialogProps) => {
  const { t } = useTranslation()
  const { exportP12 } = useCertificateTransfer(context.query)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [isChecked, setChecked] = useState(false)
  const tooShort = password.length < MIN_P12_PASSWORD
  const differ = password !== again
  const onPassword = (value: string) => {
    setPassword(value)
    setChecked(false)
  }
  const onAgain = (value: string) => {
    setAgain(value)
    setChecked(false)
  }
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || exportP12.isPending)) onClose()
  }
  const onSave = () => {
    setChecked(true)
    if (tooShort || differ) return
    exportP12.mutate({ password, serialNumber }, { onSuccess: onClose })
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t('portal.exportDialog.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3 text-sm">
              <p>{t('portal.exportDialog.body')}</p>
              <PasswordField
                label={t('portal.exportDialog.password')}
                value={password}
                error={
                  isChecked && tooShort
                    ? t('portal.exportDialog.tooShort', {
                        count: MIN_P12_PASSWORD
                      })
                    : undefined
                }
                isReadOnly={exportP12.isPending}
                autoFocus
                onChange={onPassword}
              />
              <PasswordField
                label={t('portal.exportDialog.again')}
                value={again}
                error={
                  isChecked && !tooShort && differ
                    ? t('portal.exportDialog.differ')
                    : undefined
                }
                isReadOnly={exportP12.isPending}
                onChange={onAgain}
              />
              <ActionError error={exportP12.error} />
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={onClose}
                isDisabled={exportP12.isPending}
              >
                {t('prompts.cancel')}
              </Button>
              <Button onPress={onSave} isPending={exportP12.isPending}>
                {exportP12.isPending ? (
                  <Spinner size="sm" color="current" />
                ) : null}
                {t('portal.exportDialog.save')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
