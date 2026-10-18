import { describe, expect, it } from 'vitest'

import { matchesAssetName } from '@catalog/infrastructure/asset-name.ts'

describe('matchesAssetName', () => {
  it('matches an exact name exactly', () => {
    expect(matchesAssetName('SideStore.ipa', 'SideStore.ipa')).toBe(true)
    expect(matchesAssetName('SideStore-2.ipa', 'SideStore.ipa')).toBe(false)
  })

  it('lets one * stand for the version', () => {
    expect(matchesAssetName('StikDebug-3.1.15.ipa', 'StikDebug-*.ipa')).toBe(
      true
    )
    expect(matchesAssetName('StikDebug-.ipa', 'StikDebug-*.ipa')).toBe(true)
    expect(matchesAssetName('StikDebug-3.1.15.zip', 'StikDebug-*.ipa')).toBe(
      false
    )
    expect(matchesAssetName('Other-3.1.15.ipa', 'StikDebug-*.ipa')).toBe(false)
  })

  it("doesn't let the prefix and the suffix overlap", () => {
    expect(matchesAssetName('a.ipa', 'a.ipa*.ipa')).toBe(false)
  })
})
