// Repair SideStore: the check reads what keeps SideStore from refreshing apps by itself (its certificates, its
// expiry, its pairing file), saying "can't tell" where the device doesn't show it; the repair runs only the fixes.
import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  FREE_TEAM,
  HOST_ID,
  installedApp,
  profile,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import {
  MARKER_KEY,
  markerFor
} from '@installer/application/installed/marker.ts'
import { CERTIFICATE_ID_KEY } from '@installer/sidestore/constants.ts'
import type { RemotePairingState } from '@ipaforge/device'
import {
  createDict,
  type PlistValue,
  serializeXmlPlist
} from '@ipaforge/kernel'

vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const SIDESTORE = `com.SideStore.SideStore.${FREE_TEAM.id}`
const VALID = 'AAAA01'
const PAIRING_PATH = 'Documents/PairingFile_Lockdown.plist'
const REMOTE_PATH = 'Documents/PairingFile_RemoteRP.plist'

type Setup = {
  readonly bundleId?: string
  /** The serial in IPAForge's mark; none: no mark. */
  readonly signedWith?: string
  /** `ALTCertificateID` in its Info.plist. */
  readonly holds?: string
  /** The host id in its pairing file; none: no file. */
  readonly pairedWith?: string
  readonly locked?: boolean
  /** The identifier in its remote pairing file; none: no file. */
  readonly remoteIdentifier?: string
  /** What the device says about this computer's saved remote pairing. */
  readonly saved?: RemotePairingState
  readonly ios?: string
}

const harnessFor = ({
  bundleId = SIDESTORE,
  signedWith,
  holds,
  pairedWith,
  locked,
  remoteIdentifier,
  saved,
  ios
}: Setup) => {
  const raw: [string, PlistValue][] = [['CFBundleShortVersionString', '0.6.2']]

  if (signedWith)
    raw.push([
      MARKER_KEY,
      markerFor(
        'com.SideStore.SideStore',
        { kind: 'catalog', appId: 'sidestore', channel: 'stable' },
        signedWith
      )
    ])
  if (holds) raw.push([CERTIFICATE_ID_KEY, holds])

  return createHarness({
    device: {
      locked: locked ?? false,
      ...(saved ? { savedRemotePairing: saved } : {}),
      ...(ios ? { productVersion: ios } : {}),
      installed: new Map([
        [
          bundleId,
          {
            ...installedApp(bundleId, 'SideStore'),
            shortVersion: '0.6.2',
            raw: createDict(raw)
          }
        ]
      ]),
      profiles: [profile('sidestore', FREE_TEAM.id, bundleId)],
      files: new Map([
        ...(pairedWith
          ? ([
              [
                `${bundleId}/${PAIRING_PATH}`,
                serializeXmlPlist(createDict([['HostID', pairedWith]]))
              ]
            ] as const)
          : []),
        ...(remoteIdentifier
          ? ([
              [
                `${bundleId}/${REMOTE_PATH}`,
                serializeXmlPlist(
                  createDict([['identifier', remoteIdentifier]])
                )
              ]
            ] as const)
          : [])
      ])
    },
    apple: {
      existingCertificates: [{ serialNumber: VALID, machineName: 'IPAForge' }],
      appIds: [SIDESTORE]
    }
  })
}

const check = (setup: Setup) =>
  harnessFor(setup).engine.checkSideStore({ udid: UDID, accountId: ACCOUNT })

describe('checkSideStore, remote pairing (iOS 17.4 and later)', () => {
  const remotePairingOf = async (setup: Setup) =>
    (await check({ signedWith: VALID, holds: VALID, ...setup })).sideStore
      ?.remotePairing

  it('is missing without its file, and not needed below iOS 17.4', async () => {
    expect(await remotePairingOf({})).toBe('missing')
    expect(await remotePairingOf({ ios: '17.2' })).toBe('not-needed')
  })

  it("is this computer's, accepted or refused, as the device says", async () => {
    expect(
      await remotePairingOf({
        remoteIdentifier: 'HOST-A',
        saved: { state: 'accepted', identifier: 'HOST-A' }
      })
    ).toBe('accepted')
    expect(
      await remotePairingOf({
        remoteIdentifier: 'HOST-A',
        saved: { state: 'rejected', identifier: 'HOST-A' }
      })
    ).toBe('rejected')
  })

  it("is another computer's when the file isn't the pairing this computer saved", async () => {
    expect(
      await remotePairingOf({
        remoteIdentifier: 'HOST-B',
        saved: { state: 'accepted', identifier: 'HOST-A' }
      })
    ).toBe('other-computer')
    expect(await remotePairingOf({ remoteIdentifier: 'HOST-B' })).toBe(
      'other-computer'
    )
  })
})

describe('checkSideStore', () => {
  it('finds nothing to fix in a SideStore IPAForge installed, holding a valid certificate, paired here', async () => {
    const result = await check({
      signedWith: VALID,
      holds: VALID,
      pairedWith: HOST_ID
    })

    expect(result.sideStore).toMatchObject({
      bundleId: SIDESTORE,
      version: '0.6.2',
      latest: '1.0',
      channel: 'stable',
      signedBy: 'team',
      signing: 'valid',
      ownCertificate: 'valid',
      pairing: 'this-computer'
    })
  })

  it("says it can't tell the signing certificate without a mark, and tells missing and replaced apart", async () => {
    expect(
      (await check({ pairedWith: 'ANOTHER-HOST' })).sideStore
    ).toMatchObject({
      signing: 'unknown',
      ownCertificate: 'missing',
      pairing: 'other-computer'
    })
    expect(
      (await check({ signedWith: 'GONE01', holds: 'GONE01' })).sideStore
    ).toMatchObject({
      signing: 'revoked',
      ownCertificate: 'other',
      pairing: 'missing'
    })
  })

  it("knows a SideStore another Apple ID signed, and doesn't read a locked device", async () => {
    expect(
      (await check({ bundleId: 'com.SideStore.SideStore.OTHERTEAM' })).sideStore
    ).toMatchObject({ signedBy: 'other-apple-id', signing: 'unknown' })

    const locked = await check({ locked: true })

    expect(locked.locked).toBe(true)
    expect(locked.sideStore).toBeUndefined()
  })
})

describe('repairSideStore', () => {
  it('gives a new profile and the pairing file without installing anything again', async () => {
    const harness = harnessFor({ signedWith: VALID, holds: VALID })
    const result = await harness.engine.repairSideStore(
      {
        udid: UDID,
        accountId: ACCOUNT,
        bundleId: SIDESTORE,
        reinstall: false,
        profile: true,
        pairing: true
      },
      { onPrompt: scripted() }
    ).result

    expect(result.status).toBe('completed')
    expect(harness.devices.calls.installs).toHaveLength(0)
    expect(harness.devices.calls.installedProfiles).toHaveLength(1)
    expect(
      harness.devices.calls.placed[0]?.map((target) => target.path)
    ).toEqual([PAIRING_PATH, 'Documents/ALTPairingFile.mobiledevicepairing'])
  })

  it('installs SideStore again from the catalog, with its pairing file', async () => {
    const harness = harnessFor({})
    const result = await harness.engine.repairSideStore(
      {
        udid: UDID,
        accountId: ACCOUNT,
        bundleId: SIDESTORE,
        reinstall: true,
        profile: false,
        pairing: false
      },
      { onPrompt: scripted() }
    ).result

    expect(result.status).toBe('completed')
    expect(harness.devices.calls.installs).toHaveLength(1)
    expect(harness.devices.calls.placed).toHaveLength(1)
  })
})
