import {
  DEVELOPER_MODE_IOS,
  LOCAL_DEV_VPN_IOS
} from '@ui/features/devices/checklist/constants.ts'
import type {
  ChecklistFacts,
  ChecklistItem
} from '@ui/features/devices/checklist/types.ts'

/** A step only you can see on the iPhone: to tick, or ticked. */
const onThePhone = (
  facts: ChecklistFacts,
  item: Omit<ChecklistItem, 'state' | 'tagKey' | 'isTickable'>
): ChecklistItem =>
  facts.ticked.has(item.id)
    ? {
        ...item,
        state: 'done',
        tagKey: 'checklist.tickedTag',
        isTickable: true
      }
    : { ...item, state: 'self', tagKey: 'checklist.onPhone', isTickable: true }

const beforeInstalling = (facts: ChecklistFacts): ChecklistItem[] => {
  const ios = facts.iosMajor ?? 0
  const items: ChecklistItem[] = [
    facts.isConnected
      ? {
          id: 'cable',
          group: 'before',
          state: 'done',
          titleKey: 'checklist.cable.title',
          tagKey: 'checklist.cable.connected'
        }
      : {
          id: 'cable',
          group: 'before',
          state: 'todo',
          titleKey: 'checklist.cable.title',
          tagKey: 'checklist.cable.none',
          howKeys: ['checklist.cable.how']
        },
    facts.isLocked
      ? {
          id: 'unlock',
          group: 'before',
          state: 'todo',
          titleKey: 'checklist.unlock.title',
          tagKey: 'checklist.unlock.locked',
          howKeys: ['checklist.unlock.how']
        }
      : {
          id: 'unlock',
          group: 'before',
          state: 'done',
          titleKey: 'checklist.unlock.title',
          tagKey: 'checklist.unlock.unlocked'
        },
    facts.isTrusted
      ? {
          id: 'trust',
          group: 'before',
          state: 'done',
          titleKey: 'checklist.trust.title',
          tagKey: 'checklist.trust.trusted'
        }
      : {
          id: 'trust',
          group: 'before',
          state: 'todo',
          titleKey: 'checklist.trust.title',
          tagKey: 'checklist.trust.notYet',
          howKeys: [
            'checklist.trust.step1',
            'checklist.trust.step2',
            'checklist.trust.step3'
          ],
          action: 'pair'
        },
    onThePhone(facts, {
      id: 'passcode',
      group: 'before',
      titleKey: 'checklist.passcode.title',
      howKeys: ['checklist.passcode.how']
    })
  ]

  if (ios < DEVELOPER_MODE_IOS || facts.developerMode === 'not_required')
    items.push({
      id: 'devmode',
      group: 'before',
      state: 'na',
      titleKey: 'checklist.devmode.title',
      tagKey: 'checklist.notNeeded'
    })
  else if (facts.developerMode === 'on')
    items.push({
      id: 'devmode',
      group: 'before',
      state: 'done',
      titleKey: 'checklist.devmode.title',
      tagKey: 'checklist.devmode.on'
    })
  else
    items.push({
      id: 'devmode',
      group: 'before',
      state: 'todo',
      titleKey: 'checklist.devmode.title',
      tagKey: 'checklist.devmode.off',
      howKeys: [
        'checklist.devmode.step1',
        'checklist.devmode.step2',
        'checklist.devmode.step3'
      ],
      action: 'reveal'
    })

  return items
}

const afterInstalling = (facts: ChecklistFacts): ChecklistItem[] => [
  facts.hasInstalled
    ? onThePhone(facts, {
        id: 'developer',
        group: 'after',
        titleKey: 'checklist.developer.title',
        howKeys: [
          'checklist.developer.step1',
          'checklist.developer.step2',
          'checklist.developer.step3'
        ]
      })
    : {
        id: 'developer',
        group: 'after',
        state: 'later',
        titleKey: 'checklist.developer.title',
        tagKey: 'checklist.developer.later'
      }
]

const forSideStore = (facts: ChecklistFacts): ChecklistItem[] => {
  if (!facts.hasSideStore) return []

  const repair: ChecklistItem = {
    id: 'repair',
    group: 'sidestore',
    state: 'reminder',
    titleKey: 'checklist.repair.title',
    tagKey: 'checklist.repair.tag',
    howKeys: ['checklist.repair.how'],
    action: 'repair'
  }

  if ((facts.iosMajor ?? 0) < LOCAL_DEV_VPN_IOS)
    return [
      {
        id: 'vpn',
        group: 'sidestore',
        state: 'na',
        titleKey: 'checklist.vpn.title',
        tagKey: 'checklist.notNeeded'
      },
      repair
    ]

  return [
    facts.hasLocalDevVpn
      ? {
          id: 'vpn',
          group: 'sidestore',
          state: 'done',
          titleKey: 'checklist.vpn.title',
          tagKey: 'checklist.vpn.installed'
        }
      : {
          id: 'vpn',
          group: 'sidestore',
          state: 'todo',
          titleKey: 'checklist.vpn.title',
          tagKey: 'checklist.vpn.notInstalled',
          howKeys: ['checklist.vpn.how'],
          action: 'vpnCode'
        },
    facts.hasLocalDevVpn
      ? {
          id: 'vpnOn',
          group: 'sidestore',
          state: 'reminder',
          titleKey: 'checklist.vpnOn.title',
          tagKey: 'checklist.vpnOn.tag',
          howKeys: ['checklist.vpnOn.how']
        }
      : {
          id: 'vpnOn',
          group: 'sidestore',
          state: 'later',
          titleKey: 'checklist.vpnOn.title',
          tagKey: 'checklist.vpnOn.later'
        },
    repair
  ]
}

/**
 * What the iPhone needs, in order, for its iOS version: before installing, after the first install, and for
 * SideStore when it's there. IPAForge's own checks tick themselves; what only you can see is yours to tick.
 */
export const checklistItems = (
  facts: ChecklistFacts
): readonly ChecklistItem[] => [
  ...beforeInstalling(facts),
  ...afterInstalling(facts),
  ...forSideStore(facts)
]
