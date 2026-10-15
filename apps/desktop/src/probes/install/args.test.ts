import { describe, expect, it } from 'vitest'

import { parseInstallProbeArgs } from '@desktop/probes/install/args.ts'

describe('install-probe arguments', () => {
  it('separates the command, files, option values and flags', () => {
    const args = parseInstallProbeArgs([
      'ipa',
      'a.ipa',
      '--account',
      'me',
      'b.ipa',
      '--udid',
      'X',
      '--yes'
    ])
    expect(args.command).toBe('ipa')
    expect(args.rest).toEqual(['a.ipa', 'b.ipa'])
    expect(args.option('account')).toBe('me')
    expect(args.option('udid')).toBe('X')
    expect(args.flag('yes')).toBe(true)
    expect(args.flag('livecontainer')).toBe(false)
  })

  it('has an empty command when none is given', () => {
    expect(parseInstallProbeArgs([]).command).toBe('')
  })
})
