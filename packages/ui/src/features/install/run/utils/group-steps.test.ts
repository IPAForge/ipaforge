import { describe, expect, it } from 'vitest'

import {
  groupState,
  groupSteps
} from '@ui/features/install/run/utils/group-steps.ts'
import type { StepView } from '@ui/state/active-run/types.ts'

const step = (id: string, state: StepView['state'] = 'pending'): StepView => ({
  id,
  labelKey: id,
  state,
  fraction: 0
})

const apps = [
  {
    name: 'StikDebug',
    source: { kind: 'catalog' as const, appId: 'stikdebug' }
  },
  { name: 'Game', source: { kind: 'file' as const, path: '/a/Game.ipa' } }
]

describe('groupSteps', () => {
  it('puts the shared steps first, then each app with its own steps', () => {
    const groups = groupSteps(
      [
        'device',
        'inspect-0',
        'inspect-1',
        'sign-in',
        'install-0',
        'install-1',
        'pairing'
      ].map((id) => step(id)),
      apps
    )
    expect(
      groups.map((group) => [group.app?.name, group.steps.map((s) => s.id)])
    ).toEqual([
      [undefined, ['device', 'sign-in', 'pairing']],
      ['StikDebug', ['inspect-0', 'install-0']],
      ['Game', ['inspect-1', 'install-1']]
    ])
  })
})

describe('groupState', () => {
  it('fails with any step, is done when all are, runs while one does', () => {
    expect(groupState([step('a', 'done'), step('b', 'failed')])).toBe('failed')
    expect(groupState([step('a', 'done'), step('b', 'skipped')])).toBe('done')
    expect(groupState([step('a', 'done'), step('b', 'active')])).toBe('active')
    expect(groupState([step('a')])).toBe('pending')
  })
})
