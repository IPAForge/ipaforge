import { Alert, Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { RepairPlanBox } from '@ui/features/repair/components/repair-plan-box.tsx'
import type {
  CheckRow,
  RepairPlan,
  RepairStage
} from '@ui/features/repair/types.ts'
import type { RepairOptions } from '@ui/state/active-run/types.ts'

type RepairStageBoxProps = {
  stage: RepairStage
  plan: RepairPlan | undefined
  bundleId: string | undefined
  /** The device's own check, for what to fix on it first. */
  deviceRow: CheckRow | undefined
  device: string
  isDisabled: boolean
  onRepair: (options: RepairOptions) => void
}

/** Above the checks: install SideStore first, fix the device first, nothing to repair, or the plan with Repair. */
export const RepairStageBox = ({
  stage,
  plan,
  bundleId,
  deviceRow,
  device,
  isDisabled,
  onRepair
}: RepairStageBoxProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const onInstall = () => void navigate({ to: '/install' })

  if (stage === 'not-installed')
    return (
      <NoticeBox
        status="warning"
        title={t('repair.notInstalled.title', { device })}
        body={t('repair.notInstalled.body')}
        action={
          <Button size="sm" onPress={onInstall}>
            {t('repair.notInstalled.install')}
          </Button>
        }
      />
    )
  if (stage === 'device' && deviceRow)
    return (
      <NoticeBox
        status="warning"
        title={t('repair.deviceFirst', { device })}
        body={t(deviceRow.detailKey, deviceRow.values ?? {})}
      />
    )
  if (stage === 'plan' && plan && bundleId)
    return (
      <RepairPlanBox
        plan={plan}
        bundleId={bundleId}
        device={device}
        isDisabled={isDisabled}
        onRepair={onRepair}
      />
    )

  return (
    <Alert status="success">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('repair.fine.title')}</Alert.Title>
        <Alert.Description>{t('repair.fine.body')}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}
