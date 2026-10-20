// Updating IPAForge on launch: check, and if a newer version is out, download it, quit, install it and open it
// again, while the window shows how far along it is. A check that fails or takes too long (offline) opens this
// version; a failed download, or a file whose signature isn't IPAForge's release's, lets the user try again or go
// on. A package that can't update itself only says which file to download.
import {
  CHECK_TIMEOUT_MS,
  INSTALL_DELAY_MS,
  NATIVE_BUILD_URL
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
  verifier,
  kind,
  arch,
  translated = false,
  logger,
  checkTimeoutMs = CHECK_TIMEOUT_MS,
  installDelayMs = INSTALL_DELAY_MS
}: UpdateServiceDeps): UpdateService => {
  const log = logger.child({ scope: 'updates' })
  // Done; an Intel build on Apple silicon also says where the faster one is.
  const IDLE: UpdateState = translated
    ? { phase: 'idle', nativeBuild: { url: NATIVE_BUILD_URL } }
    : { phase: 'idle' }
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
      const file = await port.download((progress) =>
        set({ phase: 'downloading', version, ...progress })
      )
      await verifier.verify(file, version)
      log.info("the update is signed by IPAForge's release", { version })
    } catch (error) {
      log.warn('the update did not download or is not signed by its release', {
        version,
        error
      })
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
    setTimeout(() => {
      port.install().catch((error: unknown) => {
        log.warn('the update did not install', { version, error })
        set({
          phase: 'failed',
          version,
          reason: reasonOf(error),
          url: releasePage(version)
        })
      })
    }, installDelayMs)
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
