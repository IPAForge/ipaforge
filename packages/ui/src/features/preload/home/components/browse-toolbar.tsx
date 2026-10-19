import { Button, ListBox, SearchField, Select } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { ALL_SOURCES } from '@ui/features/preload/home/constants.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type BrowseToolbarProps = {
  sources: readonly SourceInfo[]
  /** A source id, or ALL_SOURCES. */
  filter: string
  query: string
  sourceName: (source: SourceInfo) => string
  onFilter: (filter: string) => void
  onQuery: (query: string) => void
  onManage: () => void
}

/** Pick one source or all of them, search the apps, or go to the Sources tab. */
export const BrowseToolbar = ({
  sources,
  filter,
  query,
  sourceName,
  onFilter,
  onQuery,
  onManage
}: BrowseToolbarProps) => {
  const { t } = useTranslation()
  const onSelect = (key: Key | null) => onFilter(String(key ?? ALL_SOURCES))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t('preload.browse.source')}
        value={filter}
        onChange={onSelect}
        className="w-48"
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item
              id={ALL_SOURCES}
              textValue={t('preload.browse.allSources')}
            >
              {t('preload.browse.allSources')}
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {sources.map((source) => (
              <ListBox.Item
                key={source.id}
                id={source.id}
                textValue={sourceName(source)}
              >
                {sourceName(source)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <SearchField
        aria-label={t('preload.browse.search')}
        value={query}
        onChange={onQuery}
        className="min-w-48 flex-1"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t('preload.browse.search')} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Button size="sm" variant="tertiary" onPress={onManage}>
        {t('preload.browse.manage')}
      </Button>
    </div>
  )
}
