import { Label, ListBox, Select, Switch } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { useAutoRefreshSettings } from '@ui/hooks/use-auto-refresh-settings.ts'
import { AUTO_REFRESH_DAYS } from '@ui/state/auto-refresh/constants.ts'

/** Refresh apps automatically (on by default) and how many days before they expire. */
export const AutoRefreshCard = () => {
  const { t } = useTranslation()
  const { settings, set } = useAutoRefreshSettings()
  const onToggle = (isOn: boolean) => set({ isOn })
  const onDays = (key: Key | null) => set({ daysBefore: Number(key) })

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <h2 className="font-semibold">{t('apps.auto.title')}</h2>
          <p className="text-muted text-sm">{t('apps.auto.body')}</p>
        </div>
        <Switch size="sm" isSelected={settings.isOn} onChange={onToggle}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label className="text-sm">{t('apps.auto.toggle')}</Label>
          </Switch.Content>
        </Switch>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted text-sm">{t('apps.auto.when')}</span>
        <Select
          aria-label={t('apps.auto.when')}
          value={String(settings.daysBefore)}
          onChange={onDays}
          isDisabled={!settings.isOn}
          className="w-44"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {AUTO_REFRESH_DAYS.map((days) => (
                <ListBox.Item
                  key={days}
                  id={String(days)}
                  textValue={t('apps.auto.days', { count: days })}
                >
                  {t('apps.auto.days', { count: days })}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </section>
  )
}
