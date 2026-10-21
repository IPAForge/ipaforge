import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@ui/features/guide/components/copy-button.tsx'
import {
  APPLE_DEVICES_STORE_URL,
  LINUX_SERVICE_COMMAND
} from '@ui/features/guide/constants.ts'
import type { HostSystem } from '@ui/features/guide/types.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type ServiceFixProps = {
  system: HostSystem
}

/** What fixes a missing device service: Apple Devices in the Microsoft Store, or usbmuxd's command to copy. */
export const ServiceFix = ({ system }: ServiceFixProps) => {
  const { t } = useTranslation()
  const { links } = useUiServices()
  const onStore = () => links.open(APPLE_DEVICES_STORE_URL)

  if (system === 'windows')
    return (
      <Button size="sm" variant="secondary" onPress={onStore}>
        {t('guide.computer.service.openStore')}
      </Button>
    )
  if (system === 'linux')
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code className="overflow-x-auto rounded-lg bg-surface-secondary px-2 py-1 font-mono text-xs">
          {LINUX_SERVICE_COMMAND}
        </code>
        <CopyButton text={LINUX_SERVICE_COMMAND} />
      </div>
    )

  return null
}
