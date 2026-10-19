import { Button, ListBox, Modal, Select } from '@heroui/react'
import { Check, QrCode } from 'lucide-react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { DetailFact } from '@ui/features/preload/home/components/detail-fact.tsx'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'

type SourceAppDetailsProps = {
  entry: BrowseEntry
  versions: readonly SourceAppVersion[]
  version: SourceAppVersion | undefined
  isAdded: boolean
  onVersion: (key: Key | null) => void
  /** Install with SideStore is offered (not for SideStore itself). */
  canShare: boolean
  onShare: () => void
  onAdd: () => void
  onClose: () => void
}

/**
 * An app's details: what it is, which version (the latest, or an older one), its size, iOS and source; then Install
 * with SideStore, Close, and Add to the list.
 */
export const SourceAppDetails = ({
  entry,
  versions,
  version,
  isAdded,
  onVersion,
  canShare,
  onShare,
  onAdd,
  onClose
}: SourceAppDetailsProps) => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        {entry.sourceApp?.description ? (
          <p className="whitespace-pre-line text-sm">
            {entry.sourceApp.description}
          </p>
        ) : null}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <div className="flex flex-col gap-1">
            <dt className="text-muted text-xs">
              {t('preload.detail.version')}
            </dt>
            <dd>
              <Select
                aria-label={t('preload.detail.version')}
                value={version?.version ?? null}
                onChange={onVersion}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {versions.map((candidate, index) => (
                      <ListBox.Item
                        key={candidate.version}
                        id={candidate.version}
                        textValue={candidate.version}
                      >
                        {index === 0
                          ? t('preload.detail.latest', {
                              version: candidate.version
                            })
                          : candidate.version}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </dd>
            {version?.date ? (
              <span className="text-muted text-xs">{version.date}</span>
            ) : null}
          </div>
          {version?.size ? (
            <DetailFact
              label={t('preload.detail.size')}
              value={fileSize(version.size)}
            />
          ) : null}
          <DetailFact
            label={t('preload.detail.needs')}
            value={
              version?.minOsVersion
                ? t('preload.detail.needsIos', {
                    version: version.minOsVersion
                  })
                : t('preload.detail.anyIos')
            }
          />
          <DetailFact
            label={t('preload.detail.from')}
            value={entry.sourceName}
            note={t(
              entry.builtin ? 'preload.detail.builtin' : 'preload.detail.added'
            )}
          />
        </dl>
        {entry.builtin ? null : (
          <p className="text-muted text-xs">{t('preload.detail.untrusted')}</p>
        )}
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
        {canShare ? (
          <Button variant="tertiary" onPress={onShare}>
            <QrCode aria-hidden="true" className="size-4" />
            {t('sidestore.install')}
          </Button>
        ) : null}
        <Button variant="tertiary" onPress={onClose}>
          {t('preload.detail.close')}
        </Button>
        {isAdded ? (
          <span className="inline-flex items-center gap-1 text-accent text-sm">
            <Check aria-hidden="true" className="size-4" />
            {t('preload.detail.inList')}
          </span>
        ) : (
          <Button onPress={onAdd}>{t('preload.detail.add')}</Button>
        )}
      </Modal.Footer>
    </>
  )
}
