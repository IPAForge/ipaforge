// The iOS 17.4+ tunnel behind a session: services through it on the tunnel route, as a fallback when lockdown
// refuses one, and its lifetime.
import { describe, expect, it } from 'vitest'

import { createRig } from '@device/__tests__/setup.ts'
import { CORE_DEVICE_PROXY_SERVICE, Service } from '@device/domain/constants.ts'
import { bytesFileSource, ErrorCode, utf8Encode } from '@ipaforge/kernel'

const AFC_SHIM = 'com.apple.afc.shim.remote'
const INSTALL_SHIM = 'com.apple.mobile.installation_proxy.shim.remote'

const startServiceCount = (requests: readonly string[]) =>
  requests.filter((request) => request === 'lockdown:StartService').length

describe('the tunnel route', () => {
  it('installs an app with every service through the tunnel', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    const handle = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
    await handle.installIpa(
      bytesFileSource('App.ipa', utf8Encode('IPA:com.example.app'))
    )
    await handle.close()

    expect(rig.device.apps.has('com.example.app')).toBe(true)
    const [tunnel] = rig.device.tunnels
    expect(tunnel?.checkins).toEqual([AFC_SHIM, INSTALL_SHIM])
    // Lockdown started only CoreDeviceProxy.
    expect(startServiceCount(rig.device.requests)).toBe(1)
    expect(tunnel?.request).toEqual({
      type: 'clientHandshakeRequest',
      mtu: 8000
    })
  })

  it("lists the device's services and properties", async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    const handle = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
    const tunnel = await handle.session.tunnel()
    expect(tunnel.mtu).toBe(8000)
    expect(tunnel.services.get(AFC_SHIM)).toMatchObject({
      usesRemoteXpc: false
    })
    expect(
      tunnel.services.get('com.apple.coredevice.appservice')
    ).toMatchObject({
      usesRemoteXpc: true,
      entitlement: 'com.apple.private.example'
    })
    expect(tunnel.properties).toMatchObject({
      UniqueDeviceID: rig.device.udid,
      ProductVersion: '26.6.1'
    })
    // The same tunnel for the whole session.
    expect(await handle.session.tunnel()).toBe(tunnel)
    await handle.close()
    expect(rig.device.tunnels).toHaveLength(1)
  })

  it('closes the tunnel with the session', async () => {
    const rig = await createRig()
    const handle = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
    await handle.session.tunnel()
    await handle.close()
    await expect(rig.device.tunnels[0]?.closed).resolves.toBeUndefined()
  })

  it('uses lockdown for a service the tunnel has no counterpart for', async () => {
    const rig = await createRig()
    rig.device.tunnelOptions = { shims: new Map() }
    const handle = await rig.manager.open(rig.device.udid, { route: 'tunnel' })
    const afc = await handle.openMedia()
    await afc.mkdir('PublicStaging')
    await afc.writeFile('PublicStaging/a.txt', utf8Encode('a'))
    await afc.close()
    await handle.close()

    expect(rig.device.tunnels[0]?.checkins).toEqual([])
    expect(rig.device.media.files.has('PublicStaging/a.txt')).toBe(true)
  })

  it('throws device.tunnel_unavailable before iOS 17.4', async () => {
    const rig = await createRig({ productVersion: '17.2' })
    const handle = await rig.manager.open(rig.device.udid)
    await expect(handle.session.tunnel()).rejects.toMatchObject({
      code: ErrorCode.TunnelUnavailable,
      cause: expect.objectContaining({ code: ErrorCode.ServiceUnavailable })
    })
    await handle.close()
  })

  it('refuses a tunnel that answers for another device', async () => {
    const rig = await createRig()
    rig.device.tunnelOptions = {
      properties: { UniqueDeviceID: 'SOMEONE-ELSE' }
    }
    const handle = await rig.manager.open(rig.device.udid)
    await expect(handle.session.tunnel()).rejects.toMatchObject({
      code: ErrorCode.DeviceProtocolError,
      message: expect.stringMatching(/another device/)
    })
    await handle.close()
  })
})

describe('the tunnel as a fallback', () => {
  it('reaches a service lockdown refuses through the tunnel', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    rig.device.refusedServices.add(Service.Afc)
    const handle = await rig.manager.open(rig.device.udid)
    const afc = await handle.openMedia()
    await afc.mkdir('PublicStaging')
    await afc.writeFile('PublicStaging/b.txt', utf8Encode('b'))
    await afc.close()
    // Other services still go the usual way.
    await handle.listApps()
    await handle.close()

    expect(rig.device.media.files.has('PublicStaging/b.txt')).toBe(true)
    expect(rig.device.tunnels[0]?.checkins).toEqual([AFC_SHIM])
  })

  it('opens no tunnel while lockdown starts every service', async () => {
    const rig = await createRig({ productVersion: '26.6.1' })
    const handle = await rig.manager.open(rig.device.udid)
    await handle.installIpa(
      bytesFileSource('App.ipa', utf8Encode('IPA:com.example.app'))
    )
    await handle.close()
    expect(rig.device.tunnels).toEqual([])
    expect(rig.device.requests).not.toContain('tunnel:open')
  })

  it("keeps lockdown's refusal when the device has no tunnel", async () => {
    const rig = await createRig({ productVersion: '16.7' })
    rig.device.refusedServices.add(Service.Afc)
    const handle = await rig.manager.open(rig.device.udid)
    await expect(handle.openMedia()).rejects.toMatchObject({
      code: ErrorCode.ServiceUnavailable
    })
    // It tried once, and doesn't again for the next refusal.
    await expect(handle.openMedia()).rejects.toMatchObject({
      code: ErrorCode.ServiceUnavailable
    })
    await handle.close()
    expect(startServiceCount(rig.device.requests)).toBe(3)
  })

  it("keeps lockdown's refusal when the tunnel refuses the check-in too", async () => {
    const rig = await createRig()
    rig.device.refusedServices.add(Service.Afc)
    rig.device.tunnelOptions = { refuseCheckin: AFC_SHIM }
    const handle = await rig.manager.open(rig.device.udid)
    await expect(handle.openMedia()).rejects.toMatchObject({
      code: ErrorCode.ServiceUnavailable,
      data: expect.objectContaining({ lockdownError: 'InvalidService' })
    })
    await handle.close()
  })

  it('never routes CoreDeviceProxy itself through the fallback', async () => {
    const rig = await createRig({ productVersion: '16.7' })
    const handle = await rig.manager.open(rig.device.udid)
    await expect(
      handle.session.startService(CORE_DEVICE_PROXY_SERVICE)
    ).rejects.toMatchObject({ code: ErrorCode.ServiceUnavailable })
    await handle.close()
  })
})
