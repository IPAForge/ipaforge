import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField
} from '@heroui/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { linkProblem } from '@ui/features/preload/home/utils/check-link.ts'

type LinkDialogProps = {
  onAdd: (url: string) => void
  onClose: () => void
}

/** "Add from a link": a direct https link to an .ipa, which the Engine downloads and then reads like any app. */
export const LinkDialog = ({ onAdd, onClose }: LinkDialogProps) => {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [problemKey, setProblemKey] = useState<ReturnType<typeof linkProblem>>()
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }
  const onChange = (value: string) => {
    setUrl(value)
    setProblemKey(undefined)
  }
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    const problem = linkProblem(url)
    if (problem) {
      setProblemKey(problem)
      return
    }
    onAdd(url)
    onClose()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <form onSubmit={onFormSubmit}>
              <Modal.Header>
                <Modal.Heading>{t('preload.link.title')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-muted text-sm">{t('preload.link.body')}</p>
                <TextField
                  type="url"
                  value={url}
                  onChange={onChange}
                  isInvalid={problemKey !== undefined}
                  autoFocus
                >
                  <Label>{t('preload.link.label')}</Label>
                  <Input
                    inputMode="url"
                    placeholder={t('preload.link.placeholder')}
                  />
                  {problemKey ? <FieldError>{t(problemKey)}</FieldError> : null}
                </TextField>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="tertiary" onPress={onClose}>
                  {t('prompts.cancel')}
                </Button>
                <Button type="submit">{t('preload.link.add')}</Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
