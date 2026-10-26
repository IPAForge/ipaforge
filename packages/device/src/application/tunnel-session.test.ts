// A session entirely inside the tunnel: lockdown through the tunnel's own (checked in, no StartSession, no TLS),
// and every service through its counterpart, as a device reached only over Wi-Fi with its remote pairing uses it.
import { describe, expect, it } from 'vitest'

import { createRig } from '@device/__tests__/setup.ts'
import { createDeviceContext } from '@device/application/context.ts'
import { createDeviceHandle } from '@device/application/handle.ts'
import { openTunnelSession } from '@device/application/tunnel-session.ts'
import { resolveDeviceDeps } from '@device/deps.ts'
import { LOCKDOWN_REMOTE_SERVICE } from '@device/domain/constants.ts'
import { bytesFileSource, ErrorCode, utf8Encode } from '@ipaforge/kernel'

const ADDRESS = '192.0.2.10'
const AFC_SHIM = 'com.apple.afc.shim.remote'
const INSTALL_SHIM = 'com.apple.mobile.installation_proxy.shim.remote'

/** A tunnel (opened over USB here, as over Wi-Fi in the app) and a session inside it. */
const tunnelSession = async () => {
  const rig = await createRig({ productVersion: '26.6.1' })
  const usb = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
  const tunnel = await usb.session.tunnel()
  const ctx = createDeviceContext(
    resolveDeviceDeps({ transport: rig.fake.transport, secrets: rig.secrets })
  )
  const session = await openTunnelSession(
    ctx,
    usb.session.device,
    tunnel,
    usb.pairRecord
  )
  const lockdownRequests = rig.device.requests.length

  return {
    rig,
    usb,
    handle: createDeviceHandle(ctx, session),
    lockdownRequests
  }
}

describe('a session inside the tunnel', () => {
  it("reads the device's values through the tunnel's own lockdown", async () => {
    const { rig, usb, handle } = await tunnelSession()
    expect((await handle.session.info()).productVersion).toBe('26.6.1')
    expect(rig.device.tunnels[0]?.checkins).toContain(LOCKDOWN_REMOTE_SERVICE)
    await handle.close()
    await usb.close()
  })

  it('installs an app with every service through the tunnel, and lockdown never starts one', async () => {
    const { rig, usb, handle } = await tunnelSession()
    const startServices = () =>
      rig.device.requests.filter(
        (request) => request === 'lockdown:StartService'
      ).length
    const before = startServices()
    await handle.installIpa(
      bytesFileSource('App.ipa', utf8Encode('IPA:com.example.app'))
    )

    expect(rig.device.apps.has('com.example.app')).toBe(true)
    expect(rig.device.tunnels[0]?.checkins).toEqual([
      LOCKDOWN_REMOTE_SERVICE,
      AFC_SHIM,
      INSTALL_SHIM
    ])
    expect(startServices()).toBe(before)
    await handle.close()
    await usb.close()
  })

  it('closes the tunnel with it, and says when the tunnel has no counterpart for a service', async () => {
    const { rig, usb, handle } = await tunnelSession()
    await expect(
      handle.session.startService('com.example.missing')
    ).rejects.toMatchObject({
      code: ErrorCode.ServiceUnavailable
    })
    await handle.close()
    await expect(rig.device.tunnels[0]?.closed).resolves.toBeUndefined()
    await usb.close()
  })

  it('turns on Wi-Fi debugging for a device on Wi-Fi by lockdown at its address, never through the tunnel', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    const usb = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
    rig.fake.onWifi.set(ADDRESS, rig.device)
    const ctx = createDeviceContext(
      resolveDeviceDeps({ transport: rig.fake.transport, secrets: rig.secrets })
    )
    const onWifi = {
      ...usb.session.device,
      connectionType: 'network' as const,
      address: ADDRESS
    }
    const handle = createDeviceHandle(
      ctx,
      await openTunnelSession(
        ctx,
        onWifi,
        await usb.session.tunnel(),
        usb.pairRecord
      )
    )

    await handle.enableWifiDebugging()
    expect(rig.fake.requests).toContain(`tcp:${ADDRESS}:62078`)
    expect(
      rig.device.values.get(
        'com.apple.mobile.wireless_lockdown/EnableWifiDebugging'
      )
    ).toBe(true)
    await handle.close()
    await usb.close()
  })
})
