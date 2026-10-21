import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  type FrameLimits,
  receivePlist,
  sendPlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { plistInteger } from '@device/infrastructure/framing/plist-values.ts'
import {
  browsedApps,
  DEFAULT_APP_ATTRIBUTES,
  type InstalledApp,
  lookedUpApps
} from '@device/infrastructure/installation-proxy/apps.ts'
import { installProxyError } from '@device/infrastructure/installation-proxy/errors.ts'
import type {
  ApplicationType,
  Fields,
  InstallationProxy,
  InstallProgress,
  Watch
} from '@device/infrastructure/installation-proxy/types.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  type Logger,
  type PlistDict,
  stringAt
} from '@ipaforge/kernel'

const STATUS_COMPLETE = 'Complete'
const PERCENT_COMPLETE = 100

const browseOptionsDict = (
  applicationType: ApplicationType | undefined,
  attributes: readonly string[]
): PlistDict =>
  createDict([
    ...(applicationType ? [['ApplicationType', applicationType] as const] : []),
    ['ReturnAttributes', [...attributes]]
  ])

const lookupOptionsDict = (
  bundleIds: readonly string[],
  attributes: readonly string[]
): PlistDict =>
  createDict([
    ['BundleIDs', [...bundleIds]],
    ['ReturnAttributes', [...attributes]]
  ])

export const createInstallationProxy = (
  link: Link,
  options: { limits: FrameLimits; logger: Logger }
): InstallationProxy => {
  const { limits, logger } = options

  /**
   * The next status message. Without `idleTimeoutMs` or `signal` it waits as long as the device takes; with them,
   * silence that long or an abort closes the service (ending the read) and fails the command.
   */
  const receive = (watch: Watch): Promise<PlistDict> => {
    const reading = receivePlist(link, limits, 'installation_proxy')
    if (watch.idleTimeoutMs === undefined && !watch.signal) return reading

    return new Promise((resolve, reject) => {
      const stop = (error: IPAForgeError) => {
        cleanup()
        void link.close()
        reject(error)
      }
      const onAbort = () =>
        stop(
          new IPAForgeError(ErrorCode.Aborted, { message: 'install cancelled' })
        )
      const timer =
        watch.idleTimeoutMs === undefined
          ? undefined
          : setTimeout(
              () =>
                stop(
                  new IPAForgeError(ErrorCode.DeviceTimeout, {
                    message: `installation_proxy was silent for ${watch.idleTimeoutMs} ms (the device may be locked)`
                  })
                ),
              watch.idleTimeoutMs
            )
      const cleanup = () => {
        clearTimeout(timer)
        watch.signal?.removeEventListener('abort', onAbort)
      }
      if (watch.signal?.aborted) return onAbort()
      watch.signal?.addEventListener('abort', onAbort, { once: true })
      reading.then(
        (message) => {
          cleanup()
          resolve(message)
        },
        (error: unknown) => {
          cleanup()
          reject(error)
        }
      )
    })
  }

  /** Sends a command and reads status messages until `Complete`. */
  const run = async (
    command: string,
    subject: string,
    fields: Fields,
    onMessage: (message: PlistDict) => void = () => {},
    watch: Watch = {}
  ): Promise<void> => {
    await sendPlist(link, createDict([['Command', command], ...fields]))
    for (;;) {
      const response = await receive(watch)
      if (response.Error !== undefined)
        throw installProxyError(response, command, subject)
      onMessage(response)
      if (response.Status === STATUS_COMPLETE) return
    }
  }

  /** Forwards status messages as progress. */
  const progress =
    (onProgress: ((p: InstallProgress) => void) | undefined) =>
    (message: PlistDict): void => {
      const status = stringAt(message, 'Status')
      if (!status) return
      logger.debug('installation_proxy status', {
        status,
        percent: message.PercentComplete
      })
      const percent =
        status === STATUS_COMPLETE
          ? PERCENT_COMPLETE
          : (plistInteger(message.PercentComplete) ?? 0)
      onProgress?.({ status, percent })
    }

  return {
    install: (packagePath, installOptions = {}) =>
      run(
        installOptions.upgrade ? 'Upgrade' : 'Install',
        packagePath,
        [
          ['PackagePath', packagePath],
          ['ClientOptions', createDict()]
        ],
        progress(installOptions.onProgress),
        {
          signal: installOptions.signal,
          idleTimeoutMs: installOptions.idleTimeoutMs
        }
      ),

    uninstall: (bundleId, uninstallOptions = {}) =>
      run(
        'Uninstall',
        bundleId,
        [
          ['ApplicationIdentifier', bundleId],
          ['ClientOptions', createDict()]
        ],
        progress(uninstallOptions.onProgress)
      ),

    browse: async (browseOptions = {}) => {
      const apps: InstalledApp[] = []
      const clientOptions = browseOptionsDict(
        browseOptions.applicationType ?? 'User',
        browseOptions.attributes ?? DEFAULT_APP_ATTRIBUTES
      )
      await run(
        'Browse',
        'apps',
        [['ClientOptions', clientOptions]],
        (message) => {
          for (const app of browsedApps(message)) apps.push(app)
        }
      )
      return apps
    },

    lookup: async (bundleIds, attributes = DEFAULT_APP_ATTRIBUTES) => {
      const found = new Map<string, InstalledApp>()
      await run(
        'Lookup',
        bundleIds.join(','),
        [['ClientOptions', lookupOptionsDict(bundleIds, attributes)]],
        (message) => {
          for (const app of lookedUpApps(message)) found.set(app.bundleId, app)
        }
      )
      return found
    },

    close: () => link.close()
  }
}
