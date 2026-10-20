// Updating IPAForge on launch: check, and if a newer version is out, download it, quit, install it and open it
// again, while the window shows how far along it is. A check that fails or takes too long (offline) opens this
// version; a failed download lets the user try again or go on. A package that can't update itself only says
// which file to download.
import {
  CHECK_TIMEOUT_MS,
  INSTALL_DELAY_MS
} from '@desktop/main/updates/constants.ts'
import {
  manualUpdate,
  releasePage
} from '@desktop/main/updates/release-links.ts'
import type {
  UpdaterPort,
  UpdateService,
  UpdateServiceDeps
} from '@desktop/main/updates/types.ts'
import type { UpdateState } from '@ipaforge/rpc'

const IDLE: UpdateState = { phase: 'idle' }
const MAX_REASON_LENGTH = 500

const reasonOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(
    0,
    MAX_REASON_LENGTH
  )

/** Rejects if `promise` takes longer than `ms`. */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no answer in ${ms} ms`)),
      ms
    )
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })

export const createUpdateService = ({
  updater,
  kind,
  arch,
  logger,
  checkTimeoutMs = CHECK_TIMEOUT_MS,
  installDelayMs = INSTALL_DELAY_MS
}: UpdateServiceDeps): UpdateService => {
  const log = logger.child({ scope: 'updates' })
  const listeners = new Set<(state: UpdateState) => void>()
  let state: UpdateState = updater ? { phase: 'checking' } : IDLE
  let isRunning = false

  const set = (next: UpdateState) => {
    state = next
    for (const listener of [...listeners]) listener(next)
  }

  const download = async (port: UpdaterPort, version: string) => {
    set({
      phase: 'downloading',
      version,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0
    })
    try {
      await port.download((progress) =>
        set({ phase: 'downloading', version, ...progress })
      )
    } catch (error) {
      log.warn('the update did not download', { version, error })
      set({
        phase: 'failed',
        version,
        reason: reasonOf(error),
        url: releasePage(version)
      })
      return
    }
    log.info('installing the update', { version })
    set({ phase: 'installing', version })
    setTimeout(() => port.install(), installDelayMs)
  }

  const run = async (port: UpdaterPort) => {
    isRunning = true
    set({ phase: 'checking' })
    try {
      const version = await withTimeout(port.check(), checkTimeoutMs)
      if (!version) {
        log.info('up to date')
        set(IDLE)
      } else if (kind === 'self') {
        log.info('downloading the update', { version })
        await download(port, version)
      } else {
        log.info('an update is out; this copy cannot install it', {
          version,
          kind
        })
        set(manualUpdate(version, kind, arch))
      }
    } catch (error) {
      // Offline, or GitHub didn't answer: this version opens, and the next launch checks again.
      log.warn('could not check for updates', { error })
      set(IDLE)
    } finally {
      isRunning = false
    }
  }

  const start = () => {
    if (updater && !isRunning) void run(updater)
  }

  return {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start,
    retry: () => {
      if (state.phase === 'failed') start()
    }
  }
}
