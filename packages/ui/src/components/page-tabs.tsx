import { Tabs } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import type { PageTab } from '@ui/components/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

type PageTabsProps<T extends string> = {
  /** Names the tab list for screen readers. */
  labelKey: TranslationKey
  tabs: readonly PageTab<T>[]
  selected: T
  onSelect: (id: T) => void
}

/**
 * A page's tabs as one small pill switch, as wide as its tabs, each with how many items it holds; the chosen tab's
 * panel below. Only the chosen panel is rendered.
 */
export const PageTabs = <T extends string>({
  labelKey,
  tabs,
  selected,
  onSelect
}: PageTabsProps<T>) => {
  const { t } = useTranslation()
  const onSelectionChange = (key: Key) => {
    const tab = tabs.find((candidate) => candidate.id === key)
    if (tab) onSelect(tab.id)
  }

  return (
    <Tabs selectedKey={selected} onSelectionChange={onSelectionChange}>
      <Tabs.ListContainer className="w-max max-w-full">
        <Tabs.List
          aria-label={t(labelKey)}
          className="min-w-0 overflow-x-auto text-sm"
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              id={tab.id}
              className="gap-1.5 whitespace-nowrap px-3.5 py-1.5"
            >
              {t(tab.labelKey)}
              {tab.count === undefined ? null : (
                <span className="rounded-full bg-foreground/10 px-1.5 text-muted text-xs tabular-nums">
                  {tab.count}
                </span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {tabs.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          id={tab.id}
          className="flex flex-col gap-4 pt-4"
        >
          {tab.panel}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
