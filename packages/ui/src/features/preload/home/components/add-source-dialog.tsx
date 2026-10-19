import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField
} from '@heroui/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { SourcePreview } from '@ui/features/preload/home/components/source-preview.tsx'
import { sourceUrlProblem } from '@ui/features/preload/home/utils/source-url-problem.ts'
import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type AddSourceDialogProps = { onClose: () => void }

/**
 * Add source: a link, checked by the Engine (read, not saved), then a preview of the source with a warning, and
 * only then added. A link that isn't https, can't be reached, isn't a source or is already added says so.
 */
export const AddSourceDialog = ({ onClose }: AddSourceDialogProps) => {
  const { t } = useTranslation()
  const { check, add } = useSourceActions()
  const [url, setUrl] = useState('')
  const [problemKey, setProblemKey] = useState<TranslationKey>()
  const preview = check.data
  const errorKey = check.error
    ? errorTitleKey(toIPAForgeError(check.error).code)
    : undefined
  const shownKey = problemKey ?? errorKey
  const isBusy = check.isPending || add.isPending
  const onOpenChange = (isOpen: boolean) => {
    if (!(isOpen || isBusy)) onClose()
  }
  const onChange = (value: string) => {
    setUrl(value)
    setProblemKey(undefined)
    check.reset()
  }
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (preview) {
      add.mutate(preview.url, { onSuccess: onClose })
      return
    }

    const problem = sourceUrlProblem(url)

    if (problem) {
      setProblemKey(problem)
      return
    }
    check.mutate(url.trim())
  }
  const onBack = () => check.reset()

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <form onSubmit={onFormSubmit}>
              <Modal.Header>
                <Modal.Heading>
                  {t(
                    preview
                      ? 'preload.addSource.previewTitle'
                      : 'preload.addSource.title'
                  )}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {preview ? (
                  <SourcePreview preview={preview} />
                ) : (
                  <TextField
                    type="url"
                    value={url}
                    onChange={onChange}
                    isInvalid={shownKey !== undefined}
                    isReadOnly={check.isPending}
                    autoFocus
                  >
                    <Label>{t('preload.addSource.label')}</Label>
                    <Input
                      inputMode="url"
                      placeholder={t('preload.addSource.placeholder')}
                    />
                    {shownKey ? (
                      <FieldError>{t(shownKey)}</FieldError>
                    ) : (
                      <Description>{t('preload.addSource.hint')}</Description>
                    )}
                  </TextField>
                )}
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                {check.isPending ? (
                  <span className="me-auto text-muted text-sm" role="status">
                    {t('preload.addSource.checking')}
                  </span>
                ) : null}
                <Button
                  variant="tertiary"
                  onPress={preview ? onBack : onClose}
                  isDisabled={isBusy}
                >
                  {t(preview ? 'preload.addSource.back' : 'prompts.cancel')}
                </Button>
                <Button type="submit" isPending={isBusy}>
                  {t(
                    preview
                      ? 'preload.addSource.confirm'
                      : 'preload.addSource.check'
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
