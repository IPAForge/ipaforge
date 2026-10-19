import { Button } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { QrCode } from '@ui/components/qr-code.tsx'
import { LOCAL_DEV_VPN_URL } from '@ui/features/devices/checklist/constants.ts'
import type { ChecklistAction as Action } from '@ui/features/devices/checklist/types.ts'
import { usePairDevice } from '@ui/features/devices/hooks/use-pair-device.ts'
import { REPAIR_PATH } from '@ui/features/repair/constants.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

type ChecklistActionProps = { action: Action; udid: string }

/** What a line can do for you: ask for Trust again, show Developer Mode in Settings, LocalDevVPN's code, Repair. */
export const ChecklistAction = ({ action, udid }: ChecklistActionProps) => {
  const { t } = useTranslation()
  const engine = useEngine()
  const navigate = useNavigate()
  const pair = usePairDevice(udid)
  const reveal = useMutation({
    mutationFn: () => engine.revealDeveloperMode(udid)
  })
  const onPair = () => pair.mutate()
  const onReveal = () => reveal.mutate()
  const onRepair = () => void navigate({ to: REPAIR_PATH })

  if (action === 'pair')
    return (
      <Button size="sm" onPress={onPair} isPending={pair.isPending}>
        {t('checklist.trust.again')}
      </Button>
    )
  if (action === 'reveal')
    return reveal.isSuccess ? (
      <span className="text-sm text-success-soft-foreground">
        {t('checklist.devmode.revealed')}
      </span>
    ) : (
      <Button
        size="sm"
        variant="secondary"
        onPress={onReveal}
        isPending={reveal.isPending}
      >
        {t('checklist.devmode.reveal')}
      </Button>
    )
  if (action === 'vpnCode')
    return (
      <div className="flex flex-wrap items-center gap-3">
        <QrCode value={LOCAL_DEV_VPN_URL} label={t('checklist.vpn.qrLabel')} />
        <span className="min-w-0 flex-1 basis-48 text-muted text-sm">
          {t('checklist.vpn.scan')}
        </span>
      </div>
    )

  return (
    <Button size="sm" variant="secondary" onPress={onRepair}>
      {t('repair.open')}
    </Button>
  )
}
