import { describe, expect, it } from 'vitest'

import type { ChecklistFacts } from '@ui/features/devices/checklist/types.ts'
import { checklistItems } from '@ui/features/devices/checklist/utils/checklist-items.ts'
import { checklistProgress } from '@ui/features/devices/checklist/utils/checklist-progress.ts'

const facts = (changes: Partial<ChecklistFacts> = {}): ChecklistFacts => ({
  iosMajor: 26,
  isConnected: true,
  isTrusted: true,
  isLocked: false,
  developerMode: 'on',
  hasInstalled: true,
  hasSideStore: true,
  hasLocalDevVpn: true,
  ticked: new Set(['passcode', 'developer']),
  ...changes
})

const stateOf = (items: ReturnType<typeof checklistItems>, id: string) =>
  items.find((item) => item.id === id)?.state

describe('checklistItems', () => {
  it('is all done for a set-up iPhone, with only reminders left', () => {
    const items = checklistItems(facts())

    expect(checklistProgress(items).left).toBe(0)
    expect(stateOf(items, 'vpnOn')).toBe('reminder')
  })

  it('turns what IPAForge sees not done into steps, and what only you see into ones to tick', () => {
    const items = checklistItems(
      facts({
        isLocked: true,
        developerMode: 'off',
        hasLocalDevVpn: false,
        ticked: new Set()
      })
    )

    expect(stateOf(items, 'unlock')).toBe('todo')
    expect(items.find((item) => item.id === 'devmode')?.action).toBe('reveal')
    expect(stateOf(items, 'vpn')).toBe('todo')
    expect(stateOf(items, 'passcode')).toBe('self')
    expect(checklistProgress(items)).toMatchObject({ left: 5, seenLeft: 3 })
  })

  it('fits the iOS version: no Developer Mode before 16, no LocalDevVPN before 17', () => {
    const ios15 = checklistItems(facts({ iosMajor: 15 }))
    const ios16 = checklistItems(facts({ iosMajor: 16, hasLocalDevVpn: false }))

    expect(stateOf(ios15, 'devmode')).toBe('na')
    expect(stateOf(ios15, 'vpn')).toBe('na')
    expect(stateOf(ios16, 'vpn')).toBe('na')
  })

  it("leaves out SideStore when it isn't there, and trusting the developer until an app is", () => {
    const items = checklistItems(
      facts({ hasSideStore: false, hasInstalled: false })
    )

    expect(items.some((item) => item.group === 'sidestore')).toBe(false)
    expect(stateOf(items, 'developer')).toBe('later')
  })
})
