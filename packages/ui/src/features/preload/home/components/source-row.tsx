import { Button, Label, Spinner, Switch } from '@heroui/react'
import { QrCode, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { SourceStatusLine } from '@ui/features/preload/home/components/source-status-line.tsx'
import { isSideStoreSource } from '@ui/features/preload/sidestore/utils/sidestore-sources.ts'
import { useSourceActions } from '@ui/hooks/queries/use-source-actions.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type SourceRowProps = {
  source: SourceInfo
  name: string
  onRemove: (source: SourceInfo) => void
  onAddToSideStore: (source: SourceInfo) => void
}

/**
 * A source: its name and link, whether it's built in and what was last read, then its actions on a line of their
 * own (On/Off, Refresh, Add to SideStore for the ones you added, Remove), lined up with the text.
 */
export const SourceRow = ({
  source,
  name,
  onRemove,
  onAddToSideStore
}: SourceRowProps) => {
  const { t } = useTranslation()
  const { setEnabled, refresh } = useSourceActions()
  const isRefreshing = refresh.isPending
  const onToggle = (enabled: boolean) =>
    setEnabled.mutate({ id: source.id, enabled })
  const onRefresh = () => refresh.mutate(source.id)
  const onRemovePress = () => onRemove(source)
  const onAddToSideStorePress = () => onAddToSideStore(source)

  return (
    <li
      className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-3 py-2.5 ${source.enabled ? '' : 'opacity-70'}`}
    >
      <AppIcon name={name} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {name}
          <span
            className={`rounded-full px-2 py-0.5 font-normal text-xs ${source.builtin ? 'bg-success-soft text-success-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'}`}
          >
            {t(
              source.builtin
                ? 'preload.sources.builtin'
                : 'preload.sources.added'
            )}
          </span>
        </p>
        <p className="break-all font-mono text-muted text-xs">{source.url}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-muted text-xs">
          {isRefreshing ? (
            <>
              <Spinner size="sm" />
              {t('preload.sources.refreshing')}
            </>
          ) : (
            <SourceStatusLine source={source} />
          )}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2">
        <Switch
          size="sm"
          isSelected={source.enabled}
          isDisabled={setEnabled.isPending}
          onChange={onToggle}
          aria-label={t('preload.sources.show', { name })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label className="text-sm">
              {t(source.enabled ? 'preload.sources.on' : 'preload.sources.off')}
            </Label>
          </Switch.Content>
        </Switch>
        {source.kind === 'altstore' ? (
          <Button
            size="sm"
            variant="tertiary"
            onPress={onRefresh}
            isDisabled={isRefreshing}
            aria-label={t('preload.sources.refresh', { name })}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('preload.sources.refreshOne')}
          </Button>
        ) : null}
        {isSideStoreSource(source) ? (
          <Button size="sm" variant="tertiary" onPress={onAddToSideStorePress}>
            <QrCode aria-hidden="true" className="size-4" />
            {t('sidestore.addSource')}
          </Button>
        ) : null}
        {source.builtin ? null : (
          <Button
            size="sm"
            variant="tertiary"
            onPress={onRemovePress}
            aria-label={t('preload.sources.remove', { name })}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t('preload.sources.removeOne')}
          </Button>
        )}
      </div>
    </li>
  )
}
