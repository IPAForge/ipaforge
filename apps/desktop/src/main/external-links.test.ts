import { describe, expect, it } from 'vitest'

import { isAllowedExternalLink } from '@desktop/main/external-links.ts'

describe('isAllowedExternalLink', () => {
  it('allows a new IPAForge issue and Apple’s account and developer pages', () => {
    expect(
      isAllowedExternalLink(
        'https://github.com/SirReaDy/ipaforge/issues/new?title=x&body=y'
      )
    ).toBe(true)
    expect(isAllowedExternalLink('https://account.apple.com')).toBe(true)
    expect(isAllowedExternalLink('https://developer.apple.com/account')).toBe(
      true
    )
  })

  it('refuses everything else', () => {
    for (const url of [
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- plain HTTP must be refused
      'http://github.com/SirReaDy/ipaforge/issues/new',
      'https://github.com/SirReaDy/ipaforge/settings',
      'https://github.com/SirReaDy/ipaforge/issues/newer',
      'https://github.com.evil.example/SirReaDy/ipaforge/issues/new',
      'https://user:pass@account.apple.com',
      'https://developer.apple.com/download',
      'file:///etc/passwd',
      'not a url'
    ])
      expect(isAllowedExternalLink(url), url).toBe(false)
  })
})
