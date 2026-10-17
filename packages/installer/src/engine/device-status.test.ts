import { describe, expect, it } from 'vitest'

import { UDID } from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'

describe('engine.deviceStatus and engine.pairDevice', () => {
  it('reads the status without pairing, so an untrusted device is reported, not asked', async () => {
    const h = createHarness()
    await h.engine.deviceStatus(UDID)

    expect(h.devices.calls.openOptions).toEqual([{ autoPair: false }])
  })

  it('pairs when asked to, then reads the status, and closes the session', async () => {
    const h = createHarness()
    expect((await h.engine.pairDevice(UDID)).info.udid).toBe(UDID)

    expect(h.devices.calls.openOptions).toEqual([{ autoPair: true }])
    expect(h.devices.calls.closed).toBe(1)
  })
})
