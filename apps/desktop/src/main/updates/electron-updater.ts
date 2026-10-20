// electron-updater behind the update service's port: it never downloads or installs on its own, it takes
// prereleases (every alpha is one) but never an older version, and it logs into IPAForge's log.
import type { AppUpdater, ProgressInfo } from 'electron-updater'

import type { UpdaterPort } from '@desktop/main/updates/types.ts'
import type { Logger } from '@ipaforge/kernel'

const toText = (message: unknown): string =>
  message instanceof Error ? message.message : String(message)

export const electronUpdaterPort = (
  updater: AppUpdater,
  logger: Logger
): UpdaterPort => {
  const log = logger.child({ scope: 'updates.electron-updater' })
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = true
  updater.allowDowngrade = false
  updater.logger = {
    info: (message) => log.info(toText(message)),
    warn: (message) => log.warn(toText(message)),
    error: (message) => log.error(toText(message)),
    debug: (message) => log.debug(message)
  }

  return {
    check: async () => {
      const result = await updater.checkForUpdates()

      return result?.isUpdateAvailable ? result.updateInfo.version : undefined
    },
    // Settles on `update-downloaded`: on macOS that is when Squirrel has the update too, so installing works.
    download: (onProgress) =>
      new Promise((resolve, reject) => {
        const onDownloadProgress = (progress: ProgressInfo) =>
          onProgress({
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond
          })
        const stop = () => {
          updater.off('download-progress', onDownloadProgress)
          updater.off('update-downloaded', onDownloaded)
          updater.off('error', onError)
        }
        const onDownloaded = () => {
          stop()
          resolve()
        }
        const onError = (error: Error) => {
          stop()
          reject(error)
        }
        updater.on('download-progress', onDownloadProgress)
        updater.on('update-downloaded', onDownloaded)
        updater.on('error', onError)
        updater.downloadUpdate().catch(onError)
      }),
    // Silent on Windows (no installer wizard), and opens the new version afterwards.
    install: () => updater.quitAndInstall(true, true)
  }
}
