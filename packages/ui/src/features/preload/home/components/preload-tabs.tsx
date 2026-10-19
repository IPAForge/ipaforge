import { Tabs } from '@heroui/react'
import type { Key, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PreloadTabKey } from '@ui/features/preload/home/constants.ts'
import type { PreloadTab } from '@ui/features/preload/home/types.ts'
import { isPreloadTab } from '@ui/features/preload/home/utils/is-preload-tab.ts'

type PreloadTabsProps = {
  tab: PreloadTab
  onTab: (tab: PreloadTab) => void
  apps: ReactNode
  sources: ReactNode
}

/** Preload's two tabs: adding apps (and the list to install), and the sources Browse apps reads. */
export const PreloadTabs = ({
  tab,
  onTab,
  apps,
  sources
}: PreloadTabsProps) => {
  const { t } = useTranslation()
  const onSelectionChange = (key: Key) => {
    if (isPreloadTab(key)) onTab(key)
  }

  return (
    <Tabs selectedKey={tab} onSelectionChange={onSelectionChange}>
      <Tabs.ListContainer>
        <Tabs.List aria-label={t('preload.tabs.label')}>
          <Tabs.Tab id={PreloadTabKey.apps}>
            {t('preload.tabs.apps')}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id={PreloadTabKey.sources}>
            {t('preload.tabs.sources')}
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id={PreloadTabKey.apps} className="flex flex-col gap-6 pt-4">
        {apps}
      </Tabs.Panel>
      <Tabs.Panel id={PreloadTabKey.sources} className="pt-4">
        {sources}
      </Tabs.Panel>
    </Tabs>
  )
}
