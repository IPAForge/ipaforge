import { describe, expect, it } from 'vitest'

import { issueUrl } from '@ui/features/install/recovery/utils/issue-url.ts'

describe('issueUrl', () => {
  it('opens a new GitHub issue with the title and the diagnostics filled in', () => {
    const url = new URL(
      issueUrl('Install failed: device.locked', 'code: device.locked')
    )
    expect(url.origin + url.pathname).toBe(
      'https://github.com/IPAForge/ipaforge/issues/new'
    )
    expect(url.searchParams.get('title')).toBe('Install failed: device.locked')
    expect(url.searchParams.get('body')).toContain(
      '```\ncode: device.locked\n```'
    )
  })
})
