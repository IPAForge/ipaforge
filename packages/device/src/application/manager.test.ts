import { describe, expect, it } from 'vitest'

import {
  addApp,
  createFakeDevice,
  fakeProfile
} from '@device/__tests__/fake-device/fake-device.ts'
import { createRig, type TestRig } from '@device/__tests__/setup.ts'
import { pairRecordSecretKey } from '@device/application/pair-records.ts'
import type { PairingProgress } from '@device/application/types.ts'
import { parsePairRecord } from '@device/domain/pairing/pair-record.ts'
import { decodePem } from '@device/domain/pairing/pem.ts'
import {
  bytesFileSource,
  ErrorCode,
  LoadstarError,
  parsePlist,
  utf8Encode
} from '@loadstar/kernel'

const codeOf = async (
  promise: Promise<unknown>
): Promise<string | undefined> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof LoadstarError) return error.code
    throw error
  }
  return undefined
}

describe('devices', () => {
  it('lists devices and prefers USB over Wi-Fi for the same device', async () => {
    const rig = await createRig()
    rig.fake.devices.push(
      await createFakeDevice({
        udid: rig.device.udid,
        deviceId: 9,
        connectionType: 'Network'
      })
    )
    const devices = await rig.manager.listDevices()
    expect(devices).toEqual([
      { udid: rig.device.udid, deviceId: 7, connectionType: 'usb' }
    ])
  })

  it('reports a missing usbmuxd with its own code', async () => {
    const rig = await createRig()
    rig.fake.unavailable = true
    expect(await codeOf(rig.manager.listDevices())).toBe(
      ErrorCode.UsbmuxdUnavailable
    )
  })

  it('reports an unknown device', async () => {
    const rig = await createRig()
    expect(await codeOf(rig.manager.open('nope'))).toBe(
      ErrorCode.DeviceNotFound
    )
  })

  it('streams attach and detach events until aborted', async () => {
    const rig = await createRig()
    const events: string[] = []
    const controller = new AbortController()
    const watching = rig.manager.watch((event) => {
      events.push(
        event.kind === 'attached'
          ? `+${event.device.udid}`
          : `-${event.udid ?? event.deviceId}`
      )
      if (events.length === 3) controller.abort()
    }, controller.signal)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createFakeDevice({ udid: 'SECOND', deviceId: 8 })
    rig.fake.attach(second)
    await new Promise((resolve) => setTimeout(resolve, 5))
    rig.fake.detach('SECOND')
    await watching
    expect(events).toEqual([`+${rig.device.udid}`, '+SECOND', '-SECOND'])
  })
})

const OS_NEVER_PAIRS = {}

const pairRequests = (rig: TestRig): number =>
  rig.device.requests.filter((r) => r === 'lockdown:Pair').length

/** The OS's record stays the OS's: Loadstar never sends `SavePairRecord` (or anything else that writes). */
const expectUsbmuxdUntouched = (rig: TestRig): void => {
  expect(rig.fake.requests).not.toContain('SavePairRecord')
  expect(rig.fake.requests).not.toContain('DeletePairRecord')
}

const rejectionOf = async (
  promise: Promise<unknown>
): Promise<LoadstarError> => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e
  )
  if (!(error instanceof LoadstarError))
    throw new Error(`expected a LoadstarError, got ${String(error)}`)
  return error
}

describe('pairing and sessions', () => {
  it('waits for the OS to pair (the user taps Trust) and uses its record from usbmuxd', async () => {
    const rig = await createRig({}, {}, { osPairsAfterMisses: 3 })
    const progress: PairingProgress[] = []
    const handle = await rig.manager.open(rig.device.udid, {
      onProgress: (event) => progress.push(event)
    })
    expect(progress).toEqual([
      { stage: 'waiting_for_trust' },
      { stage: 'waiting_for_trust' },
      { stage: 'paired', savedTo: 'usbmuxd' }
    ])
    expect(rig.sleeps).toEqual([1000, 1000])
    expect(pairRequests(rig)).toBe(0)
    expect(rig.secrets.values.size).toBe(0)
    expectUsbmuxdUntouched(rig)

    const record = parsePairRecord(
      rig.fake.pairRecords.get(rig.device.udid) as Uint8Array
    )
    expect(record.systemBuid).toBe(rig.fake.buid)
    expect(handle.pairRecord.hostId).toBe(record.hostId)

    // The session was upgraded to TLS with the host credentials, pinning the device certificate.
    const tls = rig.device.tlsUpgrades[0]
    expect(tls?.expectedPeerCertificate).toEqual(
      decodePem(record.deviceCertificate).der
    )
    expect(tls?.certificatePem).toContain('BEGIN CERTIFICATE')
    await handle.close()
    expect(rig.device.requests).toContain('lockdown:StopSession')
  })

  it('pairs on its own when the OS has no record within osPairingTimeoutMs, keeping it in the secret store only', async () => {
    const rig = await createRig(
      { pendingPolls: 1 },
      { osPairingTimeoutMs: 3000 },
      OS_NEVER_PAIRS
    )
    const progress: PairingProgress[] = []
    await (
      await rig.manager.open(rig.device.udid, {
        onProgress: (event) => progress.push(event)
      })
    ).close()
    // Three polls of usbmuxd, then one pending `Pair`.
    expect(progress.map((event) => event.stage)).toEqual([
      'waiting_for_trust',
      'waiting_for_trust',
      'waiting_for_trust',
      'waiting_for_trust',
      'paired'
    ])
    expect(progress.at(-1)).toEqual({
      stage: 'paired',
      savedTo: 'secret_store'
    })
    expect(rig.sleeps).toEqual([1000, 1000, 1000, 1000])

    const stored = rig.secrets.values.get(pairRecordSecretKey(rig.device.udid))
    expect(parsePairRecord(stored as Uint8Array)).toMatchObject({
      systemBuid: rig.fake.buid,
      udid: rig.device.udid,
      wifiMacAddress: 'aa:bb:cc:dd:ee:ff'
    })
    expect(rig.fake.pairRecords.size).toBe(0)
    expectUsbmuxdUntouched(rig)

    // The next session uses the stored record without pairing again.
    const pairsBefore = pairRequests(rig)
    await (await rig.manager.open(rig.device.udid)).close()
    expect(pairRequests(rig)).toBe(pairsBefore)
  })

  it('pairs on its own straight away with method: own', async () => {
    const rig = await createRig({ pendingPolls: 2 })
    const progress: PairingProgress[] = []
    await rig.manager.pair(rig.device.udid, {
      method: 'own',
      onProgress: (event) => progress.push(event)
    })
    expect(progress.map((event) => event.stage)).toEqual([
      'waiting_for_trust',
      'waiting_for_trust',
      'paired'
    ])
    expect(progress.at(-1)).toEqual({
      stage: 'paired',
      savedTo: 'secret_store'
    })
    expect(rig.sleeps).toEqual([1000, 1000])
    expect(rig.fake.requests).not.toContain('ReadPairRecord')
    expect(rig.fake.pairRecords.size).toBe(0)
    expect(rig.secrets.values.has(pairRecordSecretKey(rig.device.udid))).toBe(
      true
    )
    expectUsbmuxdUntouched(rig)
  })

  it('asks the user to unlock while the device is locked', async () => {
    const rig = await createRig({ lockedPolls: 1 }, {}, OS_NEVER_PAIRS)
    const stages: string[] = []
    const handle = await rig.manager.open(rig.device.udid, {
      method: 'own',
      onProgress: (e) => stages.push(e.stage)
    })
    await handle.close()
    expect(stages).toEqual(['waiting_for_unlock', 'paired'])
  })

  it("fails with pairing_denied when the user taps Don't Trust", async () => {
    const rig = await createRig({ denyPairing: true }, {}, OS_NEVER_PAIRS)
    expect(
      await codeOf(rig.manager.open(rig.device.udid, { method: 'own' }))
    ).toBe(ErrorCode.PairingDenied)
  })

  it('times out when nobody answers the trust dialog', async () => {
    const config = { pairingTimeoutMs: 5000, pairingPollIntervalMs: 1000 }
    const rig = await createRig({ pendingPolls: 1000 }, config, OS_NEVER_PAIRS)
    expect(
      await codeOf(rig.manager.open(rig.device.udid, { method: 'own' }))
    ).toBe(ErrorCode.DeviceTimeout)
    expect(rig.sleeps).toHaveLength(5)
  })

  it('does not pair when autoPair is off', async () => {
    const rig = await createRig({}, {}, OS_NEVER_PAIRS)
    expect(
      await codeOf(rig.manager.open(rig.device.udid, { autoPair: false }))
    ).toBe(ErrorCode.DeviceNotPaired)
    expect(rig.sleeps).toEqual([])
  })

  it('reports a rejected OS record and never pairs over it', async () => {
    const rig = await createRig()
    await (await rig.manager.open(rig.device.udid)).close()
    const osRecord = rig.fake.pairRecords.get(rig.device.udid)
    rig.device.acceptedHostIds.clear() // e.g. the user reset "Trust" settings
    const error = await rejectionOf(rig.manager.open(rig.device.udid))
    expect(error.code).toBe(ErrorCode.InvalidPairRecord)
    expect(error.data).toMatchObject({ source: 'usbmuxd' })
    expect(error.message).toContain('tap Trust')
    expect(pairRequests(rig)).toBe(0)
    expect(rig.fake.pairRecords.get(rig.device.udid)).toBe(osRecord)
    expect(rig.secrets.values.size).toBe(0)
    expectUsbmuxdUntouched(rig)
  })

  it("pairs again once when the device rejects Loadstar's own record", async () => {
    const rig = await createRig({}, {}, OS_NEVER_PAIRS)
    await (await rig.manager.open(rig.device.udid, { method: 'own' })).close()
    const first = parsePairRecord(
      rig.secrets.values.get(pairRecordSecretKey(rig.device.udid)) as Uint8Array
    )
    rig.device.acceptedHostIds.clear()
    const handle = await rig.manager.open(rig.device.udid, { method: 'own' })
    expect(pairRequests(rig)).toBe(2)
    expect(handle.pairRecord.hostId).not.toBe(first.hostId)
    await handle.close()
    expectUsbmuxdUntouched(rig)
  })

  it('does not pair again when the TLS handshake fails', async () => {
    const rig = await createRig({}, {}, OS_NEVER_PAIRS)
    await rig.manager.pair(rig.device.udid, { method: 'own' })
    rig.device.tlsHandshakeFails = true
    expect(await codeOf(rig.manager.open(rig.device.udid))).toBe(
      ErrorCode.DeviceProtocolError
    )
    expect(pairRequests(rig)).toBe(1)
  })

  it('exports and imports pair records', async () => {
    const rig = await createRig()
    await rig.manager.pair(rig.device.udid)
    const exported = await rig.manager.exportPairRecord(rig.device.udid)
    expect(parsePairRecord(exported).systemBuid).toBe(rig.fake.buid)
    rig.fake.osPairsAfterMisses = undefined
    rig.fake.pairRecords.clear()
    expect(await rig.manager.isPaired(rig.device.udid)).toBe(false)
    await rig.manager.importPairRecord(rig.device.udid, exported)
    expect(await rig.manager.isPaired(rig.device.udid)).toBe(true)
  })
})

describe('device checks', () => {
  it('reads info, passcode and Developer Mode', async () => {
    const rig = await createRig({ developerMode: false })
    const handle = await rig.manager.open(rig.device.udid)
    const check = await handle.check()
    expect(check.info.productVersion).toBe('18.2')
    expect(check.locked).toBe(false)
    expect(check.developerMode).toBe('off')
    await handle.revealDeveloperMode()
    expect(rig.device.requests).toContain('amfi:0')
    await handle.enableWifiDebugging()
    expect(
      rig.device.values.get(
        'com.apple.mobile.wireless_lockdown/EnableWifiDebugging'
      )
    ).toBe(true)
    await handle.close()
  })

  it('does not require Developer Mode before iOS 16', async () => {
    const rig = await createRig({
      productVersion: '15.8',
      developerMode: undefined
    })
    const handle = await rig.manager.open(rig.device.udid)
    expect((await handle.check()).developerMode).toBe('not_required')
    await handle.close()
  })
})

describe('installing apps', () => {
  it('uploads, installs with progress and removes the staged copy', async () => {
    const rig = await createRig()
    const handle = await rig.manager.open(rig.device.udid)
    const percents: number[] = []
    await handle.installIpa(
      bytesFileSource('App.ipa', utf8Encode('IPA:com.example.app')),
      {
        onProgress: (p) => percents.push(p.percent)
      }
    )
    expect(rig.device.apps.has('com.example.app')).toBe(true)
    expect(percents.at(-1)).toBe(100)
    expect([...percents].sort((a, b) => a - b)).toEqual(percents)
    expect([...rig.device.media.files.keys()]).toEqual([])
    expect((await handle.listApps()).map((app) => app.bundleId)).toEqual([
      'com.example.app'
    ])
    expect(
      (await handle.lookupApps(['com.example.app', 'missing'])).has(
        'com.example.app'
      )
    ).toBe(true)
    await handle.uninstall('com.example.app')
    expect(rig.device.apps.size).toBe(0)
    await handle.close()
  })

  it('reports installation_proxy errors by name and still cleans up', async () => {
    const rig = await createRig()
    const handle = await rig.manager.open(rig.device.udid)
    rig.device.nextInstallError = 'ApplicationVerificationFailed'
    const error = await handle
      .installIpa(bytesFileSource('App.ipa', utf8Encode('IPA:x')))
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LoadstarError)
    expect((error as LoadstarError).code).toBe(ErrorCode.InstallFailed)
    expect((error as LoadstarError).data?.installError).toBe(
      'ApplicationVerificationFailed'
    )
    expect([...rig.device.media.files.keys()]).toEqual([])
    await handle.close()
  })

  it('stops uploading when aborted', async () => {
    const rig = await createRig({}, { afcWriteChunkBytes: 4 })
    const handle = await rig.manager.open(rig.device.udid)
    const controller = new AbortController()
    const install = handle.installIpa(
      bytesFileSource('App.ipa', utf8Encode('IPA:com.example.big')),
      {
        signal: controller.signal,
        onProgress: (p) => {
          if (p.stage === 'uploading' && p.percent > 0) controller.abort()
        }
      }
    )
    await expect(install).rejects.toBeDefined()
    expect(rig.device.apps.size).toBe(0)
    await handle.close()
  })
})

describe('profiles', () => {
  it('lists, installs, removes and cleans up stale profiles', async () => {
    const rig = await createRig()
    const now = new Date('2026-10-15T12:00:00Z')
    const later = new Date('2026-10-22T12:00:00Z')
    rig.device.profiles.push(
      fakeProfile({
        uuid: 'EXPIRED',
        name: 'old',
        teamId: 'TEAM1',
        bundleId: 'com.a',
        expires: new Date('2026-10-01T00:00:00Z')
      }),
      fakeProfile({
        uuid: 'UNUSED',
        name: 'gone',
        teamId: 'TEAM1',
        bundleId: 'com.gone',
        expires: later
      }),
      fakeProfile({
        uuid: 'INUSE',
        name: 'kept',
        teamId: 'TEAM1',
        bundleId: 'com.kept',
        expires: later
      }),
      fakeProfile({
        uuid: 'OTHER',
        name: 'other team',
        teamId: 'TEAM2',
        bundleId: 'com.other',
        expires: later
      })
    )
    addApp(rig.device, 'com.kept')
    const handle = await rig.manager.open(rig.device.udid)
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual([
      'EXPIRED',
      'UNUSED',
      'INUSE',
      'OTHER'
    ])

    const removed = await handle.removeStaleProfiles({ now, teamId: 'TEAM1' })
    expect(removed.map((p) => p.uuid)).toEqual(['EXPIRED', 'UNUSED'])
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual([
      'INUSE',
      'OTHER'
    ])

    await handle.installProfile(
      fakeProfile({
        uuid: 'NEW',
        name: 'n',
        teamId: 'T',
        bundleId: 'b',
        expires: later
      })
    )
    await handle.removeProfile('OTHER')
    expect((await handle.listProfiles()).map((p) => p.uuid)).toEqual([
      'INUSE',
      'NEW'
    ])
    await handle.close()
  })
})

describe('app files and pairing files', () => {
  it('places the pairing file into several apps', async () => {
    const rig = await createRig()
    const sidestore = addApp(rig.device, 'com.SideStore.SideStore.TEAM1')
    const stik = addApp(rig.device, 'com.stik.debug.TEAM1')
    const handle = await rig.manager.open(rig.device.udid)
    await handle.placePairingFile([
      {
        bundleId: sidestore.bundleId,
        path: 'Documents/ALTPairingFile.mobiledevicepairing'
      },
      { bundleId: stik.bundleId, path: 'Documents/pairingFile.plist' }
    ])
    const written = sidestore.container.files.get(
      'Documents/ALTPairingFile.mobiledevicepairing'
    )
    const plist = parsePlist(written as Uint8Array) as Record<string, unknown>
    // On-device tools refuse a pairing file without the root key or the Wi-Fi MAC address.
    expect(plist.RootPrivateKey).toBeInstanceOf(Uint8Array)
    expect(plist.HostPrivateKey).toBeInstanceOf(Uint8Array)
    expect(plist.WiFiMACAddress).toBe('aa:bb:cc:dd:ee:ff')
    const parsed = { udid: plist.UDID, hostId: plist.HostID }
    expect(parsed.udid).toBe(rig.device.udid)
    expect(parsed.hostId).toBe(handle.pairRecord.hostId)
    expect(stik.container.files.has('Documents/pairingFile.plist')).toBe(true)
    expect(
      parsePlist(
        await handle.readAppFile({
          bundleId: stik.bundleId,
          path: 'Documents/pairingFile.plist'
        })
      )
    ).toBeDefined()
    await handle.close()
  })

  it('creates missing folders and reports unknown apps', async () => {
    const rig = await createRig()
    const app = addApp(rig.device, 'com.example.app')
    const handle = await rig.manager.open(rig.device.udid)
    await handle.writeAppFile(
      { bundleId: app.bundleId, path: 'Library/Config/settings.plist' },
      utf8Encode('x')
    )
    expect(app.container.files.has('Library/Config/settings.plist')).toBe(true)
    expect(
      await codeOf(
        handle.writeAppFile(
          { bundleId: 'com.missing', path: 'a' },
          utf8Encode('x')
        )
      )
    ).toBe(ErrorCode.ServiceUnavailable)
    await handle.close()
  })
})

describe('automatic pairing placement', () => {
  it("finds the user's pairing apps and writes each file they read", async () => {
    const rig = await createRig()
    const sidestore = addApp(rig.device, 'com.SideStore.SideStore.ABCDE12345')
    const stik = addApp(rig.device, 'com.stik.stikdebug')
    addApp(rig.device, 'com.example.unrelated')
    addApp(rig.device, 'com.SideStore.SideStore.ABCDE12345.Widget') // an extension is not an app match
    const impostor = addApp(rig.device, 'com.SideStore.SideStore.EVILTEAM00') // another team's copy
    const handle = await rig.manager.open(rig.device.udid)
    const targets = await handle.pairingTargets(['ABCDE12345'])
    expect(new Set(targets.map((t) => t.appName))).toEqual(
      new Set(['SideStore', 'StikDebug'])
    )
    const placed = await handle.placePairingFile(targets)
    expect(impostor.container.files.size).toBe(0)
    expect(placed.map((t) => `${t.bundleId}:${t.path}`).sort()).toEqual([
      'com.SideStore.SideStore.ABCDE12345:Documents/ALTPairingFile.mobiledevicepairing',
      'com.SideStore.SideStore.ABCDE12345:Documents/PairingFile_Lockdown.plist',
      'com.stik.stikdebug:Documents/pairingFile.plist'
    ])
    expect(
      rig.device.values.get(
        'com.apple.mobile.wireless_lockdown/EnableWifiDebugging'
      )
    ).toBe(true)
    expect(sidestore.container.files.size).toBe(2)
    expect(stik.container.files.size).toBe(1)
    const status = await handle.appFileStatus(placed)
    expect(status.every((s) => s.exists && (s.size ?? 0) > 0)).toBe(true)
    await handle.close()
  })

  it('requires a passcode for Wi-Fi debugging', async () => {
    const rig = await createRig({ hasPasscode: false })
    addApp(rig.device, 'com.SideStore.SideStore.ABCDE12345')
    const handle = await rig.manager.open(rig.device.udid)
    const targets = await handle.pairingTargets(['ABCDE12345'])
    expect(await codeOf(handle.placePairingFile(targets))).toBe(
      ErrorCode.PasscodeRequired
    )
    await handle.close()
  })
})

describe('install failure classification', () => {
  it.each([
    [
      'ApplicationVerificationFailed',
      'Failed to verify code signature of SideStore.app : 0xe8008024 (The provisioning profile is banned.)',
      ErrorCode.ProfileBanned
    ],
    [
      'ApplicationVerificationFailed',
      '… 0xe8008018 (The identity used to sign the executable is no longer valid.)',
      ErrorCode.SigningIdentityInvalid
    ],
    [
      'ApplicationVerificationFailed',
      '… 0xe8008015 (A valid provisioning profile for this executable was not found.)',
      ErrorCode.ProfileNotFound
    ],
    ['DeviceNotSupportedByThinning', '', ErrorCode.InstallFailed]
  ])('%s / %s → %s', async (error, description, expected) => {
    const rig = await createRig()
    const handle = await rig.manager.open(rig.device.udid)
    rig.device.nextInstallError = error
    rig.device.nextInstallDescription = description
    expect(
      await codeOf(
        handle.installIpa(bytesFileSource('a.ipa', utf8Encode('IPA:a')))
      )
    ).toBe(expected)
    await handle.close()
  })

  it('lists the apps counted against the free-profile limit', async () => {
    const rig = await createRig()
    const handle = await rig.manager.open(rig.device.udid)
    rig.device.nextInstallError = 'ApplicationVerificationFailed'
    rig.device.nextInstallDescription =
      'This device has reached the maximum number of installed apps using a free developer profile: {(T.com.a.T, T.com.b.T, T.com.c.T)}'
    const error = await handle
      .installIpa(bytesFileSource('a.ipa', utf8Encode('IPA:a')))
      .catch((e: unknown) => e)
    expect((error as LoadstarError).code).toBe(ErrorCode.FreeAppLimit)
    expect((error as LoadstarError).data?.freeProfileApps).toEqual([
      'T.com.a.T',
      'T.com.b.T',
      'T.com.c.T'
    ])
    await handle.close()
  })
})
