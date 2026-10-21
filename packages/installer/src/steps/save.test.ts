import { describe, expect, it } from 'vitest'

import { signedIpaName } from '@installer/steps/save.ts'

describe('the saved file’s name', () => {
  it('is the app’s name and version', () => {
    expect(signedIpaName('SideStore', '0.7.0')).toBe('SideStore 0.7.0.ipa')
    expect(signedIpaName('MyGame', undefined)).toBe('MyGame.ipa')
  })

  it('holds nothing a file name can’t, nor a folder', () => {
    expect(signedIpaName('../evil/app: one?', '1')).toBe(
      '.._evil_app_ one_ 1.ipa'
    )
    expect(signedIpaName('', undefined)).toBe('App.ipa')
  })
})
