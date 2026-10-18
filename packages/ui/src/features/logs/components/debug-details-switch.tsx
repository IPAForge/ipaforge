import { Label, Switch } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useDebugDetails } from '@ui/features/logs/hooks/use-debug-details.ts'

/** Records debug lines too, until the app restarts. */
export const DebugDetailsSwitch = () => {
  const { t } = useTranslation()
  const debug = useDebugDetails()

  return (
    <Switch
      size="sm"
      isSelected={debug.isOn}
      isDisabled={debug.isPending}
      onChange={debug.set}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label className="text-sm">{t('logs.debug')}</Label>
      </Switch.Content>
    </Switch>
  )
}
