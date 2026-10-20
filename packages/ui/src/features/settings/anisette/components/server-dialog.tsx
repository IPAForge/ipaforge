import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField
} from '@heroui/react'
import { Activity } from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ServerStatus } from '@ui/features/settings/anisette/components/server-status.tsx'
import { useServerForm } from '@ui/features/settings/anisette/hooks/use-server-form.ts'
import type {
  ServerDialogTarget,
  ServerTestState
} from '@ui/features/settings/anisette/types.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

type ServerDialogProps = {
  target: ServerDialogTarget
  servers: readonly AnisetteServerEntry[]
  onSaved: (address: string, test: ServerTestState | undefined) => void
  onClose: () => void
}

/**
 * Add an anisette server, or edit one the user added: a name and an address (https, or http for one they run
 * themselves), a test before saving, and Save. A server that doesn't answer can still be added.
 */
export const ServerDialog = ({
  target,
  servers,
  onSaved,
  onClose
}: ServerDialogProps) => {
  const { t } = useTranslation()
  const form = useServerForm(target, servers, onSaved)
  const isEditing = target.mode === 'edit'
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || form.isSaving)) onClose()
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    form.onSave()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <form onSubmit={onSubmit}>
              <Modal.Header>
                <Modal.Heading>
                  {t(
                    isEditing
                      ? 'settings.anisette.dialog.editTitle'
                      : 'settings.anisette.dialog.addTitle'
                  )}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-muted text-sm">
                  {t('settings.anisette.dialog.body')}
                </p>
                <TextField
                  value={form.name}
                  onChange={form.onNameChange}
                  isInvalid={form.problems.name !== undefined}
                  validationBehavior="aria"
                  autoFocus
                >
                  <Label>{t('settings.anisette.dialog.name')}</Label>
                  <Input
                    placeholder={t('settings.anisette.dialog.namePlaceholder')}
                  />
                  {form.problems.name ? (
                    <FieldError>{t(form.problems.name)}</FieldError>
                  ) : null}
                </TextField>
                <TextField
                  type="url"
                  value={form.address}
                  onChange={form.onAddressChange}
                  isInvalid={form.problems.address !== undefined}
                  validationBehavior="aria"
                >
                  <Label>{t('settings.anisette.dialog.address')}</Label>
                  <Input
                    inputMode="url"
                    placeholder={t(
                      'settings.anisette.dialog.addressPlaceholder'
                    )}
                  />
                  {form.problems.address ? (
                    <FieldError>{t(form.problems.address)}</FieldError>
                  ) : (
                    <Description>
                      {t('settings.anisette.dialog.addressHint')}
                    </Description>
                  )}
                </TextField>
                <div
                  className="flex min-h-6 items-center gap-2 text-sm"
                  role="status"
                >
                  {form.test ? <ServerStatus state={form.test} /> : null}
                  {form.test?.phase === 'bad' ? (
                    <span className="text-muted">
                      {t('settings.anisette.dialog.stillAdd')}
                    </span>
                  ) : null}
                </div>
              </Modal.Body>
              <Modal.Footer className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  onPress={onClose}
                  isDisabled={form.isSaving}
                >
                  {t('prompts.cancel')}
                </Button>
                <Button
                  variant="secondary"
                  onPress={form.onTest}
                  isDisabled={form.test?.phase === 'testing'}
                >
                  <Activity aria-hidden="true" className="size-4" />
                  {t('settings.anisette.test')}
                </Button>
                <Button type="submit" isPending={form.isSaving}>
                  {t(
                    isEditing
                      ? 'settings.anisette.dialog.save'
                      : 'settings.anisette.add'
                  )}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
