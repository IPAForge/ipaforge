import { describe, expect, it } from 'vitest'

import {
  FREE_TEAM,
  installedApp,
  profile,
  UDID
} from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'
import {
  MARKER_KEY,
  markerFor
} from '@installer/application/installed/marker.ts'
import { createDict, ErrorCode, serializeXmlPlist } from '@ipaforge/kernel'

const SIDESTORE = `com.SideStore.SideStore.${FREE_TEAM.id}`
const STIK = `com.stik.stikdebug.${FREE_TEAM.id}`
const GAME = `com.example.game.${FREE_TEAM.id}`
const OTHER = `com.example.other.${FREE_TEAM.id}`
const EXPIRES = new Date('2099-01-01T00:00:00Z')
const QUERY = { udid: UDID, teamIds: [FREE_TEAM.id] }

/** An app IPAForge installed (on any computer): it carries IPAForge's mark. */
const marked = (bundleId: string, name: string) => ({
  ...installedApp(bundleId, name),
  raw: createDict([
    [
      MARKER_KEY,
      markerFor(
        bundleId.replace(`.${FREE_TEAM.id}`, ''),
        { kind: 'file', name: `${name}.ipa` },
        undefined
      )
    ]
  ])
})

const harnessWith = (
  productVersion = '18.0',
  files = new Map<string, Uint8Array>()
) =>
  createHarness({
    device: {
      productVersion,
      files,
      installed: new Map([
        [SIDESTORE, installedApp(SIDESTORE, 'SideStore')],
        [STIK, installedApp(STIK, 'StikDebug')],
        [GAME, marked(GAME, 'Game')],
        [OTHER, installedApp(OTHER, 'Another tool’s app')]
      ]),
      profiles: [SIDESTORE, STIK, GAME, OTHER].map((id, index) => ({
        ...profile(`p${index}`, FREE_TEAM.id, id),
        expirationDate: EXPIRES
      }))
    }
  })

describe('pairing files per app', () => {
  it('lists the pairing apps and the apps IPAForge installed, with whose files each holds', async () => {
    const files = new Map([
      [
        `${STIK}/Documents/pairingFile.plist`,
        serializeXmlPlist(createDict([['HostID', 'ANOTHER-COMPUTER']]))
      ]
    ])
    const h = harnessWith('26.0', files)

    const apps = await h.engine.pairingFiles(QUERY)

    expect(
      apps.map(({ bundleId, kind, classic, remote }) => ({
        bundleId,
        kind,
        classic,
        remote
      }))
    ).toEqual([
      {
        bundleId: SIDESTORE,
        kind: 'known',
        classic: 'missing',
        remote: 'missing'
      },
      {
        bundleId: STIK,
        kind: 'known',
        classic: 'other-computer',
        remote: undefined
      },
      { bundleId: GAME, kind: 'own', classic: 'missing', remote: undefined }
    ])
  })

  it('reads no remote pairing below iOS 17.4', async () => {
    const [sideStore] = await harnessWith('17.3').engine.pairingFiles(QUERY)

    expect(sideStore?.remote).toBeUndefined()
  })

  it('places a pairing app’s file at its own paths, with its remote pairing', async () => {
    const h = harnessWith('26.0')

    await h.engine.placeAppPairing({ ...QUERY, bundleId: SIDESTORE })

    expect(h.devices.calls.placed.at(-1)?.map((target) => target.path)).toEqual(
      [
        'Documents/PairingFile_Lockdown.plist',
        'Documents/ALTPairingFile.mobiledevicepairing'
      ]
    )
    expect(h.devices.calls.placedOptions.at(-1)).toBeUndefined()
    const [sideStore] = await h.engine.pairingFiles(QUERY)
    expect(sideStore?.classic).toBe('this-computer')
  })

  it('places one in an app of your own at the path given, remembers it and moves it when the path changes', async () => {
    const h = harnessWith()

    await h.engine.placeAppPairing({
      ...QUERY,
      bundleId: GAME,
      path: 'Documents/Game/pairing.plist'
    })

    expect(h.devices.calls.placed.at(-1)).toEqual([
      { bundleId: GAME, path: 'Documents/Game/pairing.plist' }
    ])
    expect(h.devices.calls.placedOptions.at(-1)).toEqual({
      remotePairing: false
    })
    const game = (await h.engine.pairingFiles(QUERY)).find(
      (app) => app.bundleId === GAME
    )
    expect(game).toMatchObject({
      classic: 'this-computer',
      path: 'Documents/Game/pairing.plist'
    })

    await h.engine.placeAppPairing({
      ...QUERY,
      bundleId: GAME,
      path: 'Library/pairingFile.plist'
    })

    expect(h.devices.calls.removedFiles).toEqual([
      { bundleId: GAME, path: 'Documents/Game/pairing.plist' }
    ])
  })

  it('refuses a path outside Documents and Library, or that climbs out', async () => {
    const h = harnessWith()

    for (const path of [
      'tmp/pairing.plist',
      'Documents/../../etc/pairing.plist',
      'Documents/pairing.txt',
      '/Documents/pairing.plist'
    ])
      await expect(
        h.engine.placeAppPairing({ ...QUERY, bundleId: GAME, path })
      ).rejects.toMatchObject({ code: ErrorCode.PairingPathInvalid })
    expect(h.devices.calls.placed).toEqual([])
  })

  it('never offers an app another tool installed', async () => {
    const h = harnessWith()

    await expect(
      h.engine.placeAppPairing({ ...QUERY, bundleId: OTHER })
    ).rejects.toMatchObject({ code: ErrorCode.PairingAppNotFound })
  })

  it('removes a pairing app’s classic and remote files, and an own app’s file with its path', async () => {
    const h = harnessWith()

    await h.engine.removeAppPairing({ ...QUERY, bundleId: SIDESTORE })
    expect(h.devices.calls.removedFiles.map((target) => target.path)).toEqual([
      'Documents/PairingFile_Lockdown.plist',
      'Documents/ALTPairingFile.mobiledevicepairing',
      'Documents/PairingFile_RemoteRP.plist'
    ])

    await h.engine.placeAppPairing({ ...QUERY, bundleId: GAME })
    await h.engine.removeAppPairing({ ...QUERY, bundleId: GAME })
    const game = (await h.engine.pairingFiles(QUERY)).find(
      (app) => app.bundleId === GAME
    )
    expect(game).toMatchObject({ classic: 'missing' })
    expect(game?.path).toBeUndefined()
  })

  it('makes a new remote pairing for the apps that read one', async () => {
    const h = harnessWith('26.0')

    await h.engine.newRemotePairing(QUERY)

    expect(h.devices.calls.placed.at(-1)?.[0]?.bundleId).toBe(SIDESTORE)
    expect(h.devices.calls.placedOptions.at(-1)).toEqual({
      newRemotePairing: true
    })
  })

  it('gives this computer’s pairing file for saving', async () => {
    const text = await harnessWith().engine.devicePairingFile(UDID)

    expect(text).toContain('HOST-THIS-COMPUTER')
  })
})
