// How an install reports its progress and adapts to the connection: the device's connection in its report, the
// signed IPA compressed over Wi-Fi only, and each install phase's percent, bytes and time on its progress updates.
import { describe, expect, it, vi } from 'vitest'

import { ACCOUNT, UDID } from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { DEFAULT_INSTALLER_CONFIG } from '@installer/domain/config.ts'
import type { RunEvent } from '@installer/engine/types.ts'

vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const install = async (connection: 'usb' | 'network') => {
  const harness = createHarness({ device: { connection } })
  const events: RunEvent[] = []
  const run = harness.engine.installSideStore(
    { udid: UDID, accountId: ACCOUNT, variant: 'sidestore' },
    { onPrompt: scripted() }
  )

  run.subscribe((event) => events.push(event))
  expect((await run.result).status).toBe('completed')

  return { harness, events }
}

const detail = (events: readonly RunEvent[], stepId: string) =>
  events.flatMap((event) =>
    event.type === 'step-detail' && event.stepId === stepId
      ? [event.detail]
      : []
  )

describe('install progress and the connection', () => {
  it('signs uncompressed over USB, and says the device is on USB', async () => {
    const { harness, events } = await install('usb')

    expect(harness.signer.calls.signed[0]?.compressionLevel).toBeUndefined()
    expect(detail(events, 'device')[0]).toMatchObject({ connection: 'usb' })
    expect(detail(events, 'sign-0')[0]).toMatchObject({ compressed: false })
  })

  it('compresses the signed IPA over Wi-Fi, and says so', async () => {
    const { harness, events } = await install('network')

    expect(harness.signer.calls.signed[0]?.compressionLevel).toBe(
      DEFAULT_INSTALLER_CONFIG.wifiCompressionLevel
    )
    expect(detail(events, 'device')[0]).toMatchObject({ connection: 'network' })
    expect(detail(events, 'sign-0')[0]).toMatchObject({ compressed: true })
  })

  it("reports each install phase's own percent, the bytes sent, the time and installd's phase", async () => {
    const { events } = await install('usb')
    const updates = events.flatMap((event) =>
      event.type === 'step-progress' && event.stepId === 'install-0'
        ? [event.detail]
        : []
    )

    expect(updates).toContainEqual(
      expect.objectContaining({
        phase: 'uploading',
        percent: 100,
        received: 2,
        total: 2,
        elapsedMs: expect.any(Number)
      })
    )
    expect(updates).toContainEqual(
      expect.objectContaining({
        phase: 'installing',
        percent: 50,
        status: 'VerifyingApplication'
      })
    )
  })

  it('reports each request to Apple while provisioning, with its task and count', async () => {
    const { events } = await install('usb')
    const updates = events.flatMap((event) =>
      event.type === 'step-progress' && event.stepId === 'provision-0'
        ? [{ fraction: event.fraction, detail: event.detail }]
        : []
    )

    expect(updates).toEqual([
      {
        fraction: 0.5,
        detail: expect.objectContaining({
          phase: 'provisioning',
          task: 'team',
          done: 2,
          total: 2
        })
      },
      {
        fraction: 1,
        detail: expect.objectContaining({
          phase: 'provisioning',
          task: 'profiles',
          done: 1,
          total: 1
        })
      }
    ])
  })
})
