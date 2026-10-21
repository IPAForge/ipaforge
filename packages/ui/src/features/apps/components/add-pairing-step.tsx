import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  Spinner,
  TextField
} from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionError } from '@ui/features/apps/components/action-error.tsx'
import { DEFAULT_PAIRING_PATH } from '@ui/features/apps/constants.ts'
import { isPairingPath } from '@ui/features/apps/utils/is-pairing-path.ts'
import type { AppPairing } from '@ui/services/engine/types.ts'

type AddPairingStepProps = {
  app: AppPairing
  isPending: boolean
  error: unknown
  onAdd: (app: AppPairing, path: string) => void
  onBack: () => void
}

/** Where in your own app the pairing file goes (from its instructions; the last one given, or the usual place). */
export const AddPairingStep = ({
  app,
  isPending,
  error,
  onAdd,
  onBack
}: AddPairingStepProps) => {
  const { t } = useTranslation()
  const [path, setPath] = useState(app.path ?? DEFAULT_PAIRING_PATH)
  const [isChecked, setChecked] = useState(false)
  const trimmed = path.trim()
  const isInvalid = isChecked && !isPairingPath(trimmed)
  const onChange = (value: string) => {
    setPath(value)
    setChecked(false)
  }
  const onPlace = () => {
    setChecked(true)
    if (isPairingPath(trimmed)) onAdd(app, trimmed)
  }

  return (
    <>
      <Modal.Header>
        <Modal.Heading>
          {t('apps.pairing.addTitle', { name: app.name })}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3">
        <p className="text-sm">{t('apps.pairing.addBody')}</p>
        <TextField
          value={path}
          onChange={onChange}
          isInvalid={isInvalid}
          isReadOnly={isPending}
          autoFocus
        >
          <Label>{t('apps.pairing.pathLabel')}</Label>
          <Input spellCheck={false} className="font-mono" />
          {isInvalid ? (
            <FieldError>{t('apps.pairing.pathInvalid')}</FieldError>
          ) : (
            <Description>{t('apps.pairing.pathHint')}</Description>
          )}
        </TextField>
        <ActionError error={error} />
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onBack} isDisabled={isPending}>
          {t('prompts.cancel')}
        </Button>
        <Button onPress={onPlace} isPending={isPending}>
          {isPending ? <Spinner size="sm" color="current" /> : null}
          {t('apps.pairing.place')}
        </Button>
      </Modal.Footer>
    </>
  )
}
