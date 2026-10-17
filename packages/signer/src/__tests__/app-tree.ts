// Test-only: the fixture app as a BundleTree, plus helpers to add bundles and shape executables.
import { join } from 'node:path'

import {
  createDict,
  fixedClock,
  type PlistDict,
  type PlistValue,
  parsePlist,
  serializeXmlPlist,
  silentLogger
} from '@loadstar/kernel'
import { FIXTURES_DIR, readTree } from '@signer/__tests__/fixtures.ts'
import { signBinary } from '@signer/application/sign-binary.ts'
import { joinPath } from '@signer/domain/bundle/tree.ts'
import type { BundleTree } from '@signer/domain/bundle/types.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import { createHasher } from '@signer/infrastructure/hashing/index.ts'

/** An executable that can be copied into new bundles (the fixture's plug-in binary). */
export const SAMPLE_EXECUTABLE = 'PlugIns/Ext.appex/Ext'

export const fixtureAppTree = (): BundleTree =>
  new Map(
    readTree(join(FIXTURES_DIR, 'inputs/Test.app')).map((e) => [
      e.path,
      e.kind === 'symlink'
        ? { kind: 'symlink' as const, target: e.target ?? '', mode: e.mode }
        : {
            kind: 'file' as const,
            data: e.data ?? new Uint8Array(),
            mode: e.mode
          }
    ])
  )

export const fileAt = (tree: BundleTree, path: string): Uint8Array => {
  const entry = tree.get(path)
  if (entry?.kind !== 'file') throw new Error(`missing ${path}`)
  return entry.data
}

export const infoAt = (tree: BundleTree, bundlePath: string): PlistDict =>
  parsePlist(fileAt(tree, joinPath(bundlePath, 'Info.plist'))) as PlistDict

export const setFile = (
  tree: BundleTree,
  path: string,
  data: Uint8Array,
  mode = 0o644
): void => {
  tree.set(path, { kind: 'file', data, mode })
}

/** Adds a bundle at `path` with the given Info.plist keys and a copy of the sample executable. */
export const addBundle = (
  tree: BundleTree,
  path: string,
  info: readonly [string, PlistValue][]
): void => {
  const executable = path
    .slice(path.lastIndexOf('/') + 1)
    .replace(/\.[^.]+$/, '')
  const plist = createDict([
    ['CFBundleExecutable', executable],
    ['CFBundlePackageType', 'XPC!'],
    ...info
  ])
  setFile(tree, joinPath(path, 'Info.plist'), serializeXmlPlist(plist))
  setFile(
    tree,
    joinPath(path, executable),
    fileAt(tree, SAMPLE_EXECUTABLE),
    0o755
  )
}

/** The executable re-signed ad hoc with `entitlements` embedded (as a previously signed app would be). */
export const withEntitlements = async (
  executable: Uint8Array,
  entitlements: PlistDict
): Promise<Uint8Array> => {
  const deps = {
    hasher: createHasher(),
    logger: silentLogger,
    clock: fixedClock(new Date('2026-10-01T00:00:00Z'))
  }
  const signed = await signBinary(
    executable,
    {
      identifier: 'fixture',
      signing: { kind: 'adhoc' },
      entitlements: {
        bytes: serializeXmlPlist(entitlements),
        dict: entitlements
      }
    },
    deps
  )

  return signed.bytes
}

/** A copy of a thin Mach-O with an LC_ENCRYPTION_INFO_64 whose cryptid is 1 (FairPlay-encrypted). */
export const encrypted = (executable: Uint8Array): Uint8Array => {
  const bytes = executable.slice()
  const slice = parseMachO(bytes).slices[0]
  if (!slice) throw new Error('not a Mach-O')
  // { cmd = LC_ENCRYPTION_INFO_64, cmdsize = 24, cryptoff, cryptsize, cryptid = 1, pad }, little-endian
  const view = new DataView(bytes.buffer)
  const at = slice.headerSize + slice.sizeofcmds
  view.setUint32(at, 0x2c, true)
  view.setUint32(at + 4, 24, true)
  view.setUint32(at + 16, 1, true)
  view.setUint32(16, slice.ncmds + 1, true)
  view.setUint32(20, slice.sizeofcmds + 24, true)
  return bytes
}
