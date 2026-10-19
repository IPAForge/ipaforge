import { useCallback, useState } from 'react'

import type { BrowseEntry } from '@ui/features/preload/home/types.ts'
import { linkLabel } from '@ui/features/preload/home/utils/check-link.ts'
import { itemFromFile } from '@ui/features/preload/home/utils/item-from-file.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { usePreloadList } from '@ui/hooks/use-preload-list.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import type { SourceAppVersion } from '@ui/services/engine/types.ts'

/** The four ways to add apps: dropped files, the host's file dialog, a link, and Browse apps. */
export const useAddApps = () => {
  const engine = useEngine()
  const { droppedFilePath, logger } = useUiServices()
  const { add } = usePreloadList()
  const [isChoosing, setChoosing] = useState(false)

  const addFiles = useCallback(
    (files: readonly File[]) =>
      add(files.map((file) => itemFromFile(file, droppedFilePath(file)))),
    [add, droppedFilePath]
  )

  const choose = () => {
    setChoosing(true)
    engine
      .chooseIpas()
      .then((chosen) =>
        add(
          chosen.map(({ path, name, size }) => ({
            label: name,
            size,
            source: { kind: 'file' as const, path }
          }))
        )
      )
      .catch(() => logger.warn('could not open the file dialog'))
      .finally(() => setChoosing(false))
  }

  const addLink = (url: string) =>
    add([{ label: linkLabel(url), source: { kind: 'url', url: url.trim() } }])

  /** An app from Browse apps: a catalog app by id, an app source's version by its download link. */
  const addBrowsed = (entry: BrowseEntry, version?: SourceAppVersion) => {
    if (entry.catalogApp) {
      const { id, name } = entry.catalogApp

      add([{ label: name, appId: id, source: { kind: 'catalog', appId: id } }])
      return
    }
    const picked = version ?? entry.sourceApp?.versions[0]

    if (!picked) return
    add([
      {
        label: entry.name,
        appId: entry.bundleId,
        origin: entry.sourceName,
        source: { kind: 'url', url: picked.downloadUrl }
      }
    ])
  }

  return { addFiles, choose, isChoosing, addLink, addBrowsed }
}
