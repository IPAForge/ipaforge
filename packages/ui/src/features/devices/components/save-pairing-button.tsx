import { Button, Spinner } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type SavePairingButtonProps = {
  udid: string
}

/**
 * Saves this computer's pairing file for the device (`<UDID>.mobiledevicepairing`), for another tool that asks for
 * one. Apps on the device get theirs from Apps › Pairing files.
 */
export const SavePairingButton = ({ udid }: SavePairingButtonProps) => {
  const { t } = useTranslation()
  const engine = useEngine()
  const { files } = useUiServices()
  const save = useMutation({
    mutationFn: async () =>
      files.save(
        `${udid}.mobiledevicepairing`,
        await engine.devicePairingFile(udid)
      )
  })
  const onSave = () => save.mutate()

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="tertiary"
        onPress={onSave}
        isPending={save.isPending}
      >
        {save.isPending ? <Spinner size="sm" color="current" /> : null}
        {t('devices.savePairing')}
      </Button>
      {save.error ? (
        <span className="text-danger text-xs" role="status">
          {t(errorTitleKey(toIPAForgeError(save.error).code))}
        </span>
      ) : null}
    </span>
  )
}
