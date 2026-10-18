import { useState } from 'react'

import { PageHeader } from '@ui/components/page-header.tsx'
import { RunElsewhereNotice } from '@ui/components/run-elsewhere-notice.tsx'
import { BlockedNotice } from '@ui/features/install/home/components/blocked-notice.tsx'
import { DeviceInUseNotice } from '@ui/features/install/home/components/device-in-use-notice.tsx'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { CatalogSection } from '@ui/features/preload/home/components/catalog-section.tsx'
import { DropZone } from '@ui/features/preload/home/components/drop-zone.tsx'
import { LinkDialog } from '@ui/features/preload/home/components/link-dialog.tsx'
import { PreloadFooter } from '@ui/features/preload/home/components/preload-footer.tsx'
import { PreloadList } from '@ui/features/preload/home/components/preload-list.tsx'
import { PreloadSummary } from '@ui/features/preload/home/components/preload-summary.tsx'
import { useAddApps } from '@ui/features/preload/home/hooks/use-add-apps.ts'
import { useFileDrop } from '@ui/features/preload/home/hooks/use-file-drop.ts'
import { usePlanTarget } from '@ui/features/preload/home/hooks/use-plan-target.ts'
import { usePreloadRows } from '@ui/features/preload/home/hooks/use-preload-rows.ts'
import { preloadReadiness } from '@ui/features/preload/home/utils/preload-readiness.ts'
import { preloadTotals } from '@ui/features/preload/home/utils/preload-totals.ts'
import { runAppsOf } from '@ui/features/preload/home/utils/run-apps-of.ts'
import { usePreloadList } from '@ui/hooks/use-preload-list.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

/**
 * The Preload page before a run: what to fix first (the device, the Apple ID), the ways to add apps, the catalog,
 * the list with what the Engine read of each app, what the whole list uses, and Install.
 */
export const PreloadHome = () => {
  const { items, remove, clear } = usePreloadList()
  const { run, startApps } = useRun()
  const { target, deviceState, accountState } = usePlanTarget()
  const { addFiles, choose, isChoosing, addLink, addCatalog } = useAddApps()
  const isOver = useFileDrop(addFiles)
  const [isLinkOpen, setLinkOpen] = useState(false)
  const rows = usePreloadRows(items, target)
  const totals = preloadTotals(rows)
  const readiness = preloadReadiness(
    isRunActive(run?.view),
    deviceState,
    accountState,
    rows,
    totals
  )
  const onLink = () => setLinkOpen(true)
  const onCloseLink = () => setLinkOpen(false)
  const onInstall = () => {
    if (!target) return
    const apps = runAppsOf(rows)
    startApps({ ...target, apps: apps.map((app) => app.source) }, apps)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titleKey="preload.title"
        descriptionKey="preload.description"
      />
      <RunElsewhereNotice page="apps" />
      <DeviceInUseNotice />
      <BlockedNotice />
      <SignInNeededNotice />
      <DropZone
        isOver={isOver}
        isChoosing={isChoosing}
        onChoose={choose}
        onLink={onLink}
      />
      <CatalogSection items={items} onAdd={addCatalog} />
      <PreloadList rows={rows} onRemove={remove} />
      {totals.apps > 0 ? <PreloadSummary totals={totals} /> : null}
      <PreloadFooter
        readiness={readiness}
        count={totals.apps}
        hasItems={items.length > 0}
        onInstall={onInstall}
        onClear={clear}
      />
      {isLinkOpen ? <LinkDialog onAdd={addLink} onClose={onCloseLink} /> : null}
    </div>
  )
}
