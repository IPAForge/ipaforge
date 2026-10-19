import { Button, ListBox, Modal, Select } from '@heroui/react'
import { Check } from 'lucide-react'
import { type Key, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { DetailFact } from '@ui/features/preload/home/components/detail-fact.tsx'
import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'

type SourceAppDialogProps = {
  entry: BrowseEntry
  isAdded: boolean
  onAdd: (entry: BrowseEntry, version: SourceAppVersion) => void
  onClose: () => void
}

/** An app source's app: what it is, which version (the latest, or an older one), its size, iOS and source. */
export const SourceAppDialog = ({
  entry,
  isAdded,
  onAdd,
  onClose
}: SourceAppDialogProps) => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()
  const versions = entry.sourceApp?.versions ?? []
  const [picked, setPicked] = useState(versions[0]?.version)
  const version =
    versions.find((candidate) => candidate.version === picked) ?? versions[0]
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }
  const onVersion = (key: Key | null) => setPicked(String(key))
  const onAddPress = () => {
    if (version) onAdd(entry, version)
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header className="flex flex-row items-center gap-3">
              <AppIcon name={entry.name} />
              <div className="flex min-w-0 flex-col">
                <Modal.Heading>{entry.name}</Modal.Heading>
                {entry.sourceApp?.developer ? (
                  <span className="text-muted text-sm">
                    {entry.sourceApp.developer}
                  </span>
                ) : null}
              </div>
            </Modal.Header>
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
                    entry.builtin
                      ? 'preload.detail.builtin'
                      : 'preload.detail.added'
                  )}
                />
              </dl>
              {entry.builtin ? null : (
                <p className="text-muted text-xs">
                  {t('preload.detail.untrusted')}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer className="flex items-center justify-end gap-2">
              <Button variant="tertiary" onPress={onClose}>
                {t('preload.detail.close')}
              </Button>
              {isAdded ? (
                <span className="inline-flex items-center gap-1 text-accent text-sm">
                  <Check aria-hidden="true" className="size-4" />
                  {t('preload.detail.inList')}
                </span>
              ) : (
                <Button onPress={onAddPress}>{t('preload.detail.add')}</Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
