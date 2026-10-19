import { describe, expect, it } from 'vitest'

import { installedApp, UDID } from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'

describe('deviceApps', () => {
  it('finds LocalDevVPN among the user apps by its name', async () => {
    const harness = createHarness({
      device: {
        installed: new Map([
          ['com.example.vpn', installedApp('com.example.vpn', 'LocalDevVPN')]
        ])
      }
    })

    expect(await harness.engine.deviceApps(UDID)).toEqual({ localDevVpn: true })
    expect(await createHarness().engine.deviceApps(UDID)).toEqual({
      localDevVpn: false
    })
  })

  it('makes the Developer Mode switch appear, and closes the session', async () => {
    const harness = createHarness()

    await harness.engine.revealDeveloperMode(UDID)

    expect(harness.devices.calls.revealed).toBe(1)
    expect(harness.devices.calls.closed).toBe(harness.devices.calls.opened)
  })
})
