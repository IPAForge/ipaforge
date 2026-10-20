import type { ReactNode } from 'react'

import { PageTabs } from '@ui/components/page-tabs.tsx'
import { PreloadTabKey } from '@ui/features/preload/home/constants.ts'
import type { PreloadTab } from '@ui/features/preload/home/types.ts'
import { useSources } from '@ui/hooks/queries/use-sources.ts'

type PreloadTabsProps = {
  tab: PreloadTab
  onTab: (tab: PreloadTab) => void
  /** How many apps are in the list to install. */
  appsCount: number
  apps: ReactNode
  sources: ReactNode
}

/** Preload's two tabs: adding apps (and the list to install), and the sources Browse apps reads. */
export const PreloadTabs = ({
  tab,
  onTab,
  appsCount,
  apps,
  sources
}: PreloadTabsProps) => {
  const sourceCount = useSources().data?.length

  return (
    <PageTabs
      labelKey="preload.tabs.label"
      selected={tab}
      onSelect={onTab}
      tabs={[
        {
          id: PreloadTabKey.apps,
          labelKey: 'preload.tabs.apps',
          count: appsCount,
          panel: apps
        },
        {
          id: PreloadTabKey.sources,
          labelKey: 'preload.tabs.sources',
          ...(sourceCount === undefined ? {} : { count: sourceCount }),
          panel: sources
        }
      ]}
    />
  )
}
