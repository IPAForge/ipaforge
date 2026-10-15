import { describe, expect, it } from 'vitest'

import { findSideStoreTarget } from '@installer/sidestore/target.ts'
import { createDict } from '@loadstar/kernel'
import type { CodeBundle } from '@loadstar/signer'

const bundle = (
  path: string,
  identifier: string,
  kind: CodeBundle['kind'] = 'framework'
): CodeBundle => ({
  path,
  kind,
  identifier,
  infoPlist: createDict(),
  executable: `${path}/Exec`,
  depth: path === '' ? 0 : path.split('/').length
})

const app = (identifier: string, ...nested: CodeBundle[]): CodeBundle[] => [
  ...nested,
  bundle('', identifier, 'app')
]

describe('findSideStoreTarget', () => {
  it('targets the main app for SideStore', () => {
    const bundles = app(
      'com.SideStore.SideStore',
      bundle('PlugIns/AltWidget.appex', 'x.AltWidget', 'appex')
    )
    expect(findSideStoreTarget(bundles)?.path).toBe('')
  })

  it('targets the SideStore framework by name inside LiveContainer', () => {
    const bundles = app(
      'com.kdt.livecontainer',
      bundle('Frameworks/Other.framework', 'com.example.other'),
      bundle('Frameworks/SideStoreApp.framework', 'some.unexpected.id')
    )
    expect(findSideStoreTarget(bundles)?.path).toBe(
      'Frameworks/SideStoreApp.framework'
    )
  })

  it("targets a framework whose bundle ID is SideStore's, whatever its name", () => {
    const bundles = app(
      'com.kdt.livecontainer',
      bundle('Frameworks/Renamed.framework', 'com.SideStore.SideStoreApp')
    )
    expect(findSideStoreTarget(bundles)?.path).toBe(
      'Frameworks/Renamed.framework'
    )
  })

  it('ignores SideStore-like bundles that are not direct frameworks of LiveContainer', () => {
    const bundles = app(
      'com.kdt.livecontainer',
      bundle(
        'Frameworks/Outer.framework/Frameworks/SideStoreApp.framework',
        'com.SideStore.SideStore'
      ),
      bundle('PlugIns/SideStore.appex', 'com.SideStore.SideStore.ext', 'appex')
    )
    expect(findSideStoreTarget(bundles)).toBeUndefined()
  })

  it('finds nothing for LiveContainer without SideStore', () => {
    expect(
      findSideStoreTarget(
        app('com.kdt.livecontainer', bundle('Frameworks/X.framework', 'x'))
      )
    ).toBeUndefined()
  })

  it('finds nothing for other apps, even if they embed a SideStore framework', () => {
    const bundles = app(
      'com.example.app',
      bundle('Frameworks/SideStoreApp.framework', 'com.SideStore.SideStore')
    )
    expect(findSideStoreTarget(bundles)).toBeUndefined()
  })
})
