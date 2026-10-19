import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { PREVIEW_APPS } from '@ui/features/preload/home/constants.ts'
import type { SourcePreview as Preview } from '@ui/services/engine/types.ts'

type SourcePreviewProps = { preview: Preview }

/** A source read but not added yet: its name, how many apps, a few of them, what was left out, and a warning. */
export const SourcePreview = ({ preview }: SourcePreviewProps) => {
  const { t } = useTranslation()
  const { content } = preview

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <AppIcon name={content.name} />
          <div className="min-w-0">
            <p className="font-semibold">{content.name}</p>
            {content.subtitle ? (
              <p className="text-muted text-sm">{content.subtitle}</p>
            ) : null}
          </div>
        </div>
        <p className="text-sm">
          {t('preload.addSource.includes', { count: content.apps.length })}
        </p>
        <ul className="list-disc ps-5 text-muted text-sm">
          {content.apps.slice(0, PREVIEW_APPS).map((app) => (
            <li key={app.bundleId}>
              {app.name} {app.versions[0]?.version}
            </li>
          ))}
        </ul>
        {content.skipped ? (
          <p className="text-muted text-xs">
            {t('preload.addSource.skipped', { count: content.skipped })}
          </p>
        ) : null}
        <p className="break-all font-mono text-muted text-xs">{preview.url}</p>
      </div>
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('preload.addSource.warningTitle')}</Alert.Title>
          <Alert.Description>
            {t('preload.addSource.warningBody')}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </div>
  )
}
