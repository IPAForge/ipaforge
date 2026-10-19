import { Button } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { MirroredIcon } from '@ui/components/mirrored-icon.tsx'
import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { DeviceInUseNotice } from '@ui/features/install/home/components/device-in-use-notice.tsx'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { RunView } from '@ui/features/install/run/run-view.tsx'
import { CheckList } from '@ui/features/repair/components/check-list.tsx'
import { ManualChecks } from '@ui/features/repair/components/manual-checks.tsx'
import { RepairStageBox } from '@ui/features/repair/components/repair-stage-box.tsx'
import { useReveal } from '@ui/features/repair/hooks/use-reveal.ts'
import { useSideStoreCheck } from '@ui/features/repair/hooks/use-sidestore-check.ts'
import { checkRows } from '@ui/features/repair/utils/check-rows.ts'
import {
  pendingRow,
  pendingRows
} from '@ui/features/repair/utils/pending-rows.ts'
import {
  repairPlan,
  repairStage
} from '@ui/features/repair/utils/repair-plan.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'
import type { RepairOptions } from '@ui/state/active-run/types.ts'

/**
 * Repair SideStore: what keeps SideStore on the device in use from refreshing apps by itself, checked line by line
 * (with what IPAForge can't see listed for you to check), the fixes in one run, then the checks again. While its
 * run goes on, or has just ended, the page shows the run.
 */
export const RepairPage = () => {
  const { t } = useTranslation()
  const { run, startRepair } = useRun()
  const inUse = useDeviceInUse()
  const account = useActiveAccount()
  const device = useDeviceView(inUse?.udid, inUse?.device).name
  const check = useSideStoreCheck()
  const onCheckAgain = () => void check.refetch()
  const now = new Date()
  // The answer once IPAForge has it; while it asks (again), every check waits with a spinner.
  const data = check.isFetching ? undefined : check.data
  const rows = data ? checkRows(data, device, now) : pendingRows(device)
  const shown = useReveal(rows.length, data ? check.dataUpdatedAt : undefined)

  if (run?.kind === 'sidestore' && run.repair) return <RunView run={run} />

  const visible = rows.map((row, index) =>
    index < shown ? row : pendingRow(row)
  )
  const isRevealed = data !== undefined && shown >= rows.length
  const health = data?.sideStore
  const plan = health ? repairPlan(health, now) : undefined
  const isBusy = check.isFetching || isRunActive(run?.view)
  const onRepair = (options: RepairOptions) => {
    if (!(inUse && account)) return
    startRepair(
      {
        udid: inUse.udid,
        accountId: account.id,
        variant: 'sidestore',
        channel: health?.channel ?? 'stable'
      },
      options
    )
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Link
        to="/apps"
        className="inline-flex w-fit items-center gap-1 font-semibold text-accent text-sm hover:underline"
      >
        <MirroredIcon icon={ArrowLeft} className="size-4" />
        {t('nav.apps')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-semibold text-2xl">{t('repair.title')}</h1>
          <p className="text-muted">{t('repair.description', { device })}</p>
        </div>
        <Button
          variant="secondary"
          onPress={onCheckAgain}
          isDisabled={isBusy || !inUse?.isConnected}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {t('repair.checkAgain')}
        </Button>
      </div>
      <DeviceInUseNotice />
      <SignInNeededNotice />
      {check.isError ? (
        <NoticeBox
          status="danger"
          title={t('repair.failed', {
            reason: t(errorTitleKey(toIPAForgeError(check.error).code))
          })}
          body={t('repair.failedBody')}
        />
      ) : null}
      {isRevealed && data ? (
        <RepairStageBox
          stage={repairStage(data, plan)}
          plan={plan}
          bundleId={health?.bundleId}
          deviceRow={rows[0]}
          device={device}
          isDisabled={isBusy}
          onRepair={onRepair}
        />
      ) : null}
      {data || check.isFetching ? (
        <>
          <p aria-live="polite" className="sr-only">
            {isRevealed ? null : t('repair.checking')}
          </p>
          <CheckList rows={visible} />
        </>
      ) : null}
      {isRevealed && health ? <ManualChecks /> : null}
    </div>
  )
}
