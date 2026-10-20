import { describe, expect, it } from 'vitest'

import {
  remotePairingTargets,
  supportsRemotePairing
} from '@device/domain/pairing-apps.ts'
import {
  parseRemotePairing,
  remotePairingFile,
  serializeRemotePairing
} from '@device/domain/remote-pairing/record.ts'
import type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'
import { isPlistDict, parsePlist } from '@ipaforge/kernel'

const record: RemotePairingRecord = {
  identifier: 'EA08DE29-B7BA-A633-2EED-5E3F2F381862',
  publicKey: new Uint8Array(32).fill(1),
  privateKey: new Uint8Array(32).fill(2),
  deviceIdentifier: 'E25CE045-BD3B-4838-B9BF-A4882792A653',
  devicePublicKey: new Uint8Array(32).fill(3),
  altIrk: new Uint8Array(16).fill(4)
}

describe('remote pairing for SideStore', () => {
  it('starts with iOS 17.4', () => {
    expect(supportsRemotePairing([17, 3, 1])).toBe(false)
    expect(supportsRemotePairing([17, 4, 0])).toBe(true)
    expect(supportsRemotePairing([26, 0, 0])).toBe(true)
    expect(supportsRemotePairing([16, 7, 0])).toBe(false)
  })

  it("goes next to SideStore's classic files, alone or in LiveContainer, and nowhere else", () => {
    expect(
      remotePairingTargets([
        { bundleId: 'ss', path: 'Documents/PairingFile_Lockdown.plist' },
        {
          bundleId: 'ss',
          path: 'Documents/ALTPairingFile.mobiledevicepairing'
        },
        {
          bundleId: 'lc',
          path: 'Documents/SideStore/Documents/PairingFile_Lockdown.plist'
        },
        { bundleId: 'stik', path: 'Documents/pairingFile.plist' }
      ])
    ).toEqual([
      { bundleId: 'ss', path: 'Documents/PairingFile_RemoteRP.plist' },
      {
        bundleId: 'lc',
        path: 'Documents/SideStore/Documents/PairingFile_RemoteRP.plist'
      }
    ])
  })

  it("writes only the remote keys, as SideStore reads them, so the file isn't ambiguous", () => {
    const plist = parsePlist(remotePairingFile(record))

    expect(isPlistDict(plist) ? Object.keys(plist).sort() : []).toEqual([
      'alt_irk',
      'identifier',
      'private_key',
      'public_key'
    ])
  })

  it('round-trips through the secret store, and reads a broken entry as none', () => {
    expect(parseRemotePairing(serializeRemotePairing(record))).toEqual(record)
    expect(parseRemotePairing(new TextEncoder().encode('{'))).toBeUndefined()
    expect(parseRemotePairing(undefined)).toBeUndefined()
  })
})
