import { describe, expect, it } from 'vitest'

import {
  bytesFileSource,
  concatBytes,
  createDict,
  ErrorCode,
  type FileSource,
  type PlistValue,
  serializeXmlPlist,
  silentLogger,
  withKey
} from '@loadstar/kernel'
import {
  addBundle,
  encrypted,
  fileAt,
  fixtureAppTree,
  infoAt,
  setFile,
  withEntitlements
} from '@signer/__tests__/app-tree.ts'
import { readFixture } from '@signer/__tests__/fixtures.ts'
import { inspectIpa } from '@signer/application/inspect-ipa.ts'
import type { BundleTree } from '@signer/domain/bundle/tree.ts'
import {
  CPU_SUBTYPE_ARM_V7,
  CPU_TYPE_ARM
} from '@signer/domain/macho/constants.ts'
import { planSideloadIdentity } from '@signer/domain/sideload/identity-plan.ts'
import { writeIpa } from '@signer/infrastructure/ipa/index.ts'

const MAIN = 'com.loadstar.fixture.app'
const TEAM = 'ABCDE12345'

const ipaOf = async (app: BundleTree): Promise<FileSource> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of writeIpa(
    { appName: 'Test.app', app, extras: new Map() },
    { logger: silentLogger }
  )) {
    chunks.push(chunk)
  }
  return bytesFileSource('Test.ipa', concatBytes(chunks))
}

const setInfoKey = (tree: BundleTree, key: string, value: PlistValue): void => {
  setFile(
    tree,
    'Info.plist',
    serializeXmlPlist(withKey(infoAt(tree, ''), key, value))
  )
}

/** A copy of a thin Mach-O relabelled as 32-bit ARMv7 (cputype and cpusubtype, little-endian). */
const asArmv7 = (executable: Uint8Array): Uint8Array => {
  const bytes = executable.slice()
  const view = new DataView(bytes.buffer)
  view.setInt32(4, CPU_TYPE_ARM, true)
  view.setInt32(8, CPU_SUBTYPE_ARM_V7, true)
  return bytes
}

/** The fixture app with an ExtensionKit extension, a watch app and its extension. */
const nestedTree = (): BundleTree => {
  const tree = fixtureAppTree()
  addBundle(tree, 'Extensions/Kit.appex', [
    ['CFBundleIdentifier', `${MAIN}.kit`],
    ['CFBundleDisplayName', 'Kit Display']
  ])
  addBundle(tree, 'Watch/W.app', [
    ['CFBundleIdentifier', `${MAIN}.watchkitapp`],
    ['CFBundleName', 'Watch Name']
  ])
  addBundle(tree, 'Watch/W.app/PlugIns/X.appex', [
    ['CFBundleIdentifier', `${MAIN}.watchkitapp.ext`]
  ])
  return tree
}

describe('inspectIpa', () => {
  it('reports the app, every provisioned nested bundle and the declared groups', async () => {
    const tree = nestedTree()
    const entitlements = createDict([
      [
        'com.apple.security.application-groups',
        [`group.${MAIN}`, 'group.com.loadstar.shared']
      ],
      ['keychain-access-groups', ['OLDTEAM456.com.loadstar.shared']]
    ])
    setFile(
      tree,
      'Test',
      await withEntitlements(fileAt(tree, 'Test'), entitlements),
      0o755
    )

    const inspection = await inspectIpa(await ipaOf(tree))
    expect(inspection).toEqual({
      app: {
        path: 'Payload/Test.app',
        identifier: MAIN,
        name: 'Test',
        version: '1.0',
        minimumOSVersion: '14.0',
        deviceFamilies: [1],
        architectures: ['arm64']
      },
      nested: [
        {
          path: 'Extensions/Kit.appex',
          kind: 'appex',
          identifier: `${MAIN}.kit`,
          name: 'Kit Display'
        },
        {
          path: 'PlugIns/Ext.appex',
          kind: 'appex',
          identifier: `${MAIN}.ext`,
          name: 'Ext'
        },
        {
          path: 'Watch/W.app',
          kind: 'watch-app',
          identifier: `${MAIN}.watchkitapp`,
          name: 'Watch Name'
        },
        {
          path: 'Watch/W.app/PlugIns/X.appex',
          kind: 'appex',
          identifier: `${MAIN}.watchkitapp.ext`,
          name: 'X'
        }
      ],
      appGroups: [`group.${MAIN}`, 'group.com.loadstar.shared'],
      keychainAccessGroups: ['OLDTEAM456.com.loadstar.shared'],
      altAppGroups: [`group.${MAIN}`]
    })

    const plan = planSideloadIdentity(inspection, TEAM)
    expect(plan.bundles.map((bundle) => bundle.identifier)).toEqual([
      `${MAIN}.${TEAM}`,
      `${MAIN}.${TEAM}.kit`,
      `${MAIN}.${TEAM}.ext`,
      `${MAIN}.${TEAM}.watchkitapp`,
      `${MAIN}.${TEAM}.watchkitapp.ext`
    ])
    expect(plan.appGroup).toBe(`group.${MAIN}.${TEAM}`)
  })

  it('reports the declared device families and every slice of a universal executable', async () => {
    const tree = fixtureAppTree()
    setInfoKey(tree, 'UIDeviceFamily', [1, 2])
    setFile(tree, 'Test', readFixture('inputs', 'fat'), 0o755)
    const { app } = await inspectIpa(await ipaOf(tree))
    expect(app.deviceFamilies).toEqual([1, 2])
    expect(app.architectures).toEqual(['arm64', 'arm64e'])
  })

  it('reports a 32-bit-only executable as armv7', async () => {
    const tree = fixtureAppTree()
    setFile(tree, 'Test', asArmv7(fileAt(tree, 'Test')), 0o755)
    expect((await inspectIpa(await ipaOf(tree))).app.architectures).toEqual([
      'armv7'
    ])
  })

  it('refuses an app without a usable Info.plist', async () => {
    const tree = fixtureAppTree()
    tree.delete('Info.plist')
    await expect(inspectIpa(await ipaOf(tree))).rejects.toMatchObject({
      code: ErrorCode.InvalidBundle
    })
  })

  it('refuses an app with a FairPlay-encrypted binary', async () => {
    const tree = fixtureAppTree()
    setFile(tree, 'Test', encrypted(fileAt(tree, 'Test')), 0o755)
    await expect(inspectIpa(await ipaOf(tree))).rejects.toMatchObject({
      code: ErrorCode.EncryptedBinary,
      data: { path: 'Test' }
    })
  })

  it("refuses a nested bundle whose ID is not prefixed by the app's", async () => {
    const tree = nestedTree()
    addBundle(tree, 'Extensions/Kit.appex', [
      ['CFBundleIdentifier', 'com.elsewhere.kit']
    ])
    await expect(inspectIpa(await ipaOf(tree))).rejects.toMatchObject({
      code: ErrorCode.ExtensionPrefix
    })
  })

  it('honours an aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      inspectIpa(await ipaOf(fixtureAppTree()), { signal: controller.signal })
    ).rejects.toThrow()
  })
})
