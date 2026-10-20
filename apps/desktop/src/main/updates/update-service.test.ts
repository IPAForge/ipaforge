import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InstallKind, UpdaterPort } from '@desktop/main/updates/types.ts'
import { createUpdateService } from '@desktop/main/updates/update-service.ts'
import { silentLogger as logger } from '@ipaforge/kernel'
import type { UpdateState } from '@ipaforge/rpc'

const NEXT = '0.1.0-alpha.99'

/** An updater whose check and download the test answers. */
const fakeUpdater = (version: string | undefined) => {
  let finishDownload: (() => void) | undefined
  let failDownload: ((error: Error) => void) | undefined
  let reportProgress: Parameters<UpdaterPort['download']>[0] | undefined
  const port = {
    check: vi.fn(async () => version),
    download: vi.fn(
      (onProgress: Parameters<UpdaterPort['download']>[0]) =>
        new Promise<void>((resolve, reject) => {
          reportProgress = onProgress
          finishDownload = resolve
          failDownload = reject
        })
    ),
    install: vi.fn()
  } satisfies UpdaterPort

  return {
    port,
    progress: (transferred: number) =>
      reportProgress?.({ transferred, total: 100, bytesPerSecond: 10 }),
    finish: () => finishDownload?.(),
    fail: (message: string) => failDownload?.(new Error(message))
  }
}

const start = (
  updater: UpdaterPort | undefined,
  kind: InstallKind = 'self',
  arch = 'x64'
) => {
  const service = createUpdateService({ updater, kind, arch, logger })
  const states: UpdateState[] = []
  service.subscribe((state) => states.push(state))
  service.start()

  return { service, states }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createUpdateService', () => {
  it('stays idle without an updater (a development build)', () => {
    const { service } = start(undefined)

    expect(service.current()).toEqual({ phase: 'idle' })
  })

  it('opens the app when it is up to date', async () => {
    const { service, states } = start(fakeUpdater(undefined).port)
    await vi.runAllTimersAsync()

    expect(states.map((state) => state.phase)).toEqual(['checking', 'idle'])
    expect(service.current()).toEqual({ phase: 'idle' })
  })

  it('downloads a newer version with progress, then installs it', async () => {
    const updater = fakeUpdater(NEXT)
    const { service } = start(updater.port)
    await vi.advanceTimersByTimeAsync(0)

    updater.progress(40)
    expect(service.current()).toEqual({
      phase: 'downloading',
      version: NEXT,
      transferred: 40,
      total: 100,
      bytesPerSecond: 10
    })

    updater.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(service.current()).toEqual({ phase: 'installing', version: NEXT })
    expect(updater.port.install).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(updater.port.install).toHaveBeenCalledOnce()
  })

  it('says why a download failed, and tries again when asked', async () => {
    const updater = fakeUpdater(NEXT)
    const { service } = start(updater.port)
    await vi.advanceTimersByTimeAsync(0)

    updater.fail('net::ERR_CONNECTION_RESET')
    await vi.advanceTimersByTimeAsync(0)
    expect(service.current()).toEqual({
      phase: 'failed',
      version: NEXT,
      reason: 'net::ERR_CONNECTION_RESET',
      url: `https://github.com/SirReaDy/ipaforge/releases/tag/v${NEXT}`
    })

    service.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(updater.port.check).toHaveBeenCalledTimes(2)
    expect(service.current().phase).toBe('downloading')
  })

  it('opens the app when the check fails (offline)', async () => {
    const port: UpdaterPort = {
      check: () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')),
      download: vi.fn(),
      install: vi.fn()
    }
    const { service } = start(port)
    await vi.runAllTimersAsync()

    expect(service.current()).toEqual({ phase: 'idle' })
  })

  it('opens the app when the check takes too long', async () => {
    const port: UpdaterPort = {
      check: () => new Promise(() => {}),
      download: vi.fn(),
      install: vi.fn()
    }
    const { service } = start(port)
    await vi.advanceTimersByTimeAsync(14_000)
    expect(service.current()).toEqual({ phase: 'checking' })

    await vi.advanceTimersByTimeAsync(2000)
    expect(service.current()).toEqual({ phase: 'idle' })
  })

  it.each([
    ['msi', 'x64', 'IPAForge-0.1.0-alpha.99-win-x64.msi'],
    ['deb', 'x64', 'IPAForge-0.1.0-alpha.99-linux-amd64.deb'],
    ['deb', 'arm64', 'IPAForge-0.1.0-alpha.99-linux-arm64.deb'],
    ['rpm', 'x64', 'IPAForge-0.1.0-alpha.99-linux-x86_64.rpm'],
    ['rpm', 'arm64', 'IPAForge-0.1.0-alpha.99-linux-aarch64.rpm']
  ] as const)(
    'names the file for a %s on %s, without downloading it',
    async (kind, arch, fileName) => {
      const updater = fakeUpdater(NEXT)
      const { service } = start(updater.port, kind, arch)
      await vi.runAllTimersAsync()

      expect(service.current()).toEqual({
        phase: 'manual',
        version: NEXT,
        packageType: kind,
        fileName,
        url: `https://github.com/SirReaDy/ipaforge/releases/download/v${NEXT}/${fileName}`
      })
      expect(updater.port.download).not.toHaveBeenCalled()
    }
  )

  it('points another package to the release page', async () => {
    const { service } = start(fakeUpdater(NEXT).port, 'other')
    await vi.runAllTimersAsync()

    expect(service.current()).toEqual({
      phase: 'manual',
      version: NEXT,
      packageType: 'other',
      url: `https://github.com/SirReaDy/ipaforge/releases/tag/v${NEXT}`
    })
  })
})
