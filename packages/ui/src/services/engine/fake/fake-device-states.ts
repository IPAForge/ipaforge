// What the fake Engine's devices answer when their status is read: lock state, Developer Mode and trust. Each
// scenario starts from its own states; the `devices` scenario shows every state and how each one is fixed (Check
// again sees the iPad unlocked, Ask again pairs the iPhone SE, whose Developer Mode is still off).
import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import type { DeviceCheck } from '@ui/services/engine/engine-types.ts'
import {
  FAKE_IPAD,
  FAKE_IPHONE,
  FAKE_IPHONE_SE,
  fakeIphoneCheck
} from '@ui/services/engine/fake/fake-data.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/fake-scenarios.ts'

type FakeDeviceState = {
  readonly check: DeviceCheck
  trusted: boolean
  /** Status reads left before the user "unlocks" it. */
  locksFor: number
}

const ipadCheck: DeviceCheck = {
  info: {
    udid: FAKE_IPAD,
    name: 'Studio iPad',
    productType: 'iPad14,8',
    productVersion: '18.6',
    buildVersion: '22G86',
    deviceClass: 'iPad'
  },
  locked: false,
  developerMode: 'on',
  activated: true
}

const iphoneSeCheck: DeviceCheck = {
  info: {
    udid: FAKE_IPHONE_SE,
    name: 'Test iPhone SE',
    productType: 'iPhone12,8',
    productVersion: '17.5',
    buildVersion: '21F79',
    deviceClass: 'iPhone'
  },
  locked: false,
  developerMode: 'off',
  activated: true
}

const initialStates = (scenario: FakeScenarioId) => {
  const showcase = scenario === 'devices'

  return new Map<string, FakeDeviceState>([
    [FAKE_IPHONE, { check: fakeIphoneCheck, trusted: true, locksFor: 0 }],
    [
      FAKE_IPAD,
      { check: ipadCheck, trusted: showcase, locksFor: showcase ? 1 : 0 }
    ],
    [FAKE_IPHONE_SE, { check: iphoneSeCheck, trusted: false, locksFor: 0 }]
  ])
}

export type FakeDeviceStates = {
  status: (udid: string) => Promise<DeviceCheck>
  pair: (udid: string) => Promise<DeviceCheck>
}

export const createFakeDeviceStates = (
  scenario: FakeScenarioId
): FakeDeviceStates => {
  const states = initialStates(scenario)

  const status = async (udid: string): Promise<DeviceCheck> => {
    const state = states.get(udid)
    if (!state?.trusted)
      throw new LoadstarError(ErrorCode.DeviceNotPaired, { data: { udid } })
    const locked = state.locksFor > 0
    if (locked) state.locksFor -= 1

    return { ...state.check, locked }
  }

  return {
    status,
    pair: async (udid) => {
      const state = states.get(udid)
      if (!state)
        throw new LoadstarError(ErrorCode.DeviceNotFound, { data: { udid } })
      state.trusted = true
      return status(udid)
    }
  }
}
