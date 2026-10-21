import { describe, expect, it } from 'vitest'

import { createHarness } from '@installer/__tests__/harness.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

describe('the setup guide’s computer check', () => {
  it('finds everything ready', async () => {
    expect(await createHarness().engine.systemCheck()).toEqual({
      deviceService: 'ok',
      apple: true,
      clockOk: true,
      clockSkewSeconds: 0,
      anisette: { server: 'Fake', tried: 1 }
    })
  })

  it('tells a missing device service and a wrong clock apart, and names the first anisette server that answers', async () => {
    const h = createHarness({
      apple: {
        preflight: {
          apple: { ok: true },
          clockOk: false,
          clockSkewSeconds: -300,
          anisette: [
            { server: { name: 'A', address: 'https://a.example' }, ok: false },
            { server: { name: 'B', address: 'https://b.example' }, ok: true }
          ]
        }
      }
    })
    Object.assign(h.devices.manager, {
      listDevices: async () => {
        throw new IPAForgeError(ErrorCode.UsbmuxdUnavailable)
      }
    })

    expect(await h.engine.systemCheck()).toEqual({
      deviceService: 'missing',
      apple: true,
      clockOk: false,
      clockSkewSeconds: -300,
      anisette: { server: 'B', tried: 2 }
    })
  })
})
