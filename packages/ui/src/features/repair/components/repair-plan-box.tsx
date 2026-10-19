import { Button } from '@heroui/react'
import { Wrench } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { FixOffer } from '@ui/features/repair/components/fix-offer.tsx'
import { fixKeys } from '@ui/features/repair/constants.ts'
import type { Fix, RepairPlan } from '@ui/features/repair/types.ts'
import { repairOptions } from '@ui/features/repair/utils/repair-plan.ts'
import type { RepairOptions } from '@ui/state/active-run/types.ts'

type RepairPlanBoxProps = {
  plan: RepairPlan
  bundleId: string
  device: string
  isDisabled: boolean
  onRepair: (options: RepairOptions) => void
}

/**
 * What Repair will do (the needed fixes), what it can do too if you want (the offered ones), why it can't install
 * SideStore again with this Apple ID when another one signed it, and Repair.
 */
export const RepairPlanBox = ({
  plan,
  bundleId,
  device,
  isDisabled,
  onRepair
}: RepairPlanBoxProps) => {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<readonly Fix[]>([])
  const options = repairOptions(bundleId, plan, picked)
  const canRun = options.reinstall || options.profile || options.pairing
  const hasFixes = plan.required.length + plan.optional.length > 0
  const onPick = (fix: Fix, isPicked: boolean) =>
    setPicked((current) =>
      isPicked ? [...current, fix] : current.filter((one) => one !== fix)
    )
  const onRepairPress = () => onRepair(options)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
      {plan.blocked ? (
        <NoticeBox
          status="warning"
          title={t('repair.blocked.title')}
          body={t('repair.blocked.body')}
        />
      ) : null}
      {plan.required.length > 0 ? (
        <>
          <h2 className="font-semibold">{t('repair.plan.title')}</h2>
          <ol className="flex list-decimal flex-col gap-1 ps-5">
            {plan.required.map((fix) => (
              <li key={fix}>
                {t(fixKeys[fix].title)}
                <span className="block text-muted text-sm">
                  {t(fixKeys[fix].body)}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {plan.optional.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted text-sm">{t('repair.plan.optional')}</h3>
          {plan.optional.map((fix) => (
            <FixOffer
              key={fix}
              fix={fix}
              isPicked={picked.includes(fix)}
              isDisabled={isDisabled}
              onChange={onPick}
            />
          ))}
        </div>
      ) : null}
      {hasFixes ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted text-sm">
            {t('repair.plan.hint', { device })}
          </span>
          <Button onPress={onRepairPress} isDisabled={isDisabled || !canRun}>
            <Wrench aria-hidden="true" className="size-4" />
            {t('repair.plan.start')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
