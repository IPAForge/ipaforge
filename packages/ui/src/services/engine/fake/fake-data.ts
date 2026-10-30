// The fake Engine's world: two devices (one ready over USB, one over Wi-Fi that does not trust this computer),
// two saved Apple IDs, the catalog's two SideStore apps, and what each team has.
import type {
  Account,
  CatalogApp,
  Device,
  DeviceCheck,
  Team
} from '@ui/services/engine/types.ts'

export const FAKE_IPHONE = '00008140-0011223344556677'
export const FAKE_IPAD = '00008103-8899AABBCCDDEEFF'
export const FAKE_IPHONE_SE = '00008030-0019245E1A88802E'

export const fakeDevices: Device[] = [
  { udid: FAKE_IPHONE, deviceId: 1, connectionType: 'usb' },
  { udid: FAKE_IPAD, deviceId: 2, connectionType: 'network' }
]

/** The `devices` scenario: the iPhone on USB and Wi-Fi, the iPad on Wi-Fi, and an iPhone SE on USB. */
export const showcaseDevices: Device[] = [
  ...fakeDevices,
  { udid: FAKE_IPHONE, deviceId: 3, connectionType: 'network' },
  { udid: FAKE_IPHONE_SE, deviceId: 4, connectionType: 'usb' }
]

export const fakeIphoneCheck: DeviceCheck = {
  info: {
    udid: FAKE_IPHONE,
    name: 'iPhone',
    productType: 'iPhone17,1',
    productVersion: '26.1',
    buildVersion: '23B85',
    deviceClass: 'iPhone'
  },
  locked: false,
  developerMode: 'on',
  activated: true
}

export const PERSONAL_TEAM: Team = {
  id: 'A1B2C3D4E5',
  name: 'Personal team',
  isFree: true
}

export const STUDIO_TEAM: Team = {
  id: 'F6G7H8J9K0',
  name: 'Example Studio',
  isFree: false
}

export const fakeAccounts = (): Account[] => [
  {
    id: 'work@example.com',
    appleId: 'work@example.com',
    displayName: 'Work',
    health: { bannedOnDevices: [] }
  },
  {
    id: 'studio@example.com',
    appleId: 'studio@example.com',
    displayName: 'Studio',
    health: { bannedOnDevices: [] }
  }
]

/** An Apple ID whose saved session expired (the `accounts` scenario). */
export const EXPIRED_ACCOUNT: Account = {
  id: 'old@example.com',
  appleId: 'old@example.com',
  health: { bannedOnDevices: [] }
}

export const fakeCatalogApps: CatalogApp[] = [
  {
    id: 'sidestore',
    name: 'SideStore',
    bundleId: 'com.SideStore.SideStore',
    kind: 'sidestore',
    channels: {
      stable: {
        github: { repo: 'SideStore/SideStore', asset: 'SideStore.ipa' }
      },
      nightly: {
        github: {
          repo: 'SideStore/SideStore',
          tag: 'nightly',
          asset: 'SideStore.ipa'
        }
      }
    }
  },
  {
    id: 'livecontainer-sidestore',
    name: 'LiveContainer + SideStore',
    bundleId: 'com.kdt.livecontainer',
    kind: 'livecontainer-sidestore',
    channels: {
      stable: {
        github: {
          repo: 'LiveContainer/LiveContainer',
          asset: 'LiveContainer+SideStore.ipa'
        }
      }
    }
  },
  {
    id: 'livecontainer',
    name: 'LiveContainer',
    bundleId: 'com.kdt.livecontainer',
    kind: 'app',
    channels: {
      stable: {
        github: {
          repo: 'LiveContainer/LiveContainer',
          asset: 'LiveContainer.ipa'
        }
      }
    }
  },
  {
    id: 'stikdebug',
    name: 'StikDebug',
    bundleId: 'com.stik.stikdebug',
    kind: 'app',
    minimumIos: '17.4',
    channels: {
      stable: {
        github: { repo: 'StikDebug/StikDebug', asset: 'StikDebug-*.ipa' }
      }
    }
  },
  {
    id: 'feather',
    name: 'Feather',
    bundleId: 'thewonderofyou.Feather',
    kind: 'app',
    channels: {
      stable: { github: { repo: 'khcrysalis/Feather', asset: 'Feather.ipa' } }
    }
  }
]

export const fakeCertificates = [
  {
    serialNumber: 'FAKECERT01',
    machineName: 'IPAForge',
    expiresAt: '2027-05-10T00:00:00.000Z'
  },
  {
    serialNumber: '5A1E00C0FFEE0001',
    machineName: 'SideStore',
    expiresAt: '2027-06-01T00:00:00.000Z'
  },
  {
    serialNumber: '5A1E00C0FFEE0002',
    machineName: 'MacBook Pro',
    expiresAt: '2027-08-15T00:00:00.000Z'
  }
]

export const fakeRemovableApps = [
  { bundleId: 'com.kdt.livecontainer.A1B2C3D4E5', name: 'LiveContainer' },
  { bundleId: 'com.stik.debug.A1B2C3D4E5', name: 'StikDebug' },
  { bundleId: 'com.example.myapp.A1B2C3D4E5' }
]

export const fakePairingApps = [
  { bundleId: 'com.SideStore.SideStore.A1B2C3D4E5', appName: 'SideStore' },
  { bundleId: 'com.stik.debug.A1B2C3D4E5', appName: 'StikDebug' }
]

export const FAKE_TWO_FACTOR_CODE = '123456'
/** The size the fake download reports, in bytes. */
export const FAKE_IPA_SIZE = 28_000_000

/** The code the fake Apple TV and Vision Pro show; any other is wrong. */
export const FAKE_PAIRING_CODE = '482913'

export const FAKE_TV = '00008110-0012345678ABCDEF'
/** Addresses from the documentation range (RFC 5737): the fake devices are never on a real network. */

const FAKE_TV_ADDRESS = '192.0.2.42'

const FAKE_VISION_ADDRESS = '192.0.2.57'
export const FAKE_VISION = '00008112-001A2B3C4D5E6F70'

/** The fake Apple TV and Vision Pro while their pairing screen is open: what the network search finds. */
export const fakePairable = [
  {
    id: 'Living Room._remotepairing-manual-pairing._tcp.local',
    name: 'Living Room',
    model: 'AppleTV14,1',
    address: FAKE_TV_ADDRESS,
    port: 49_152
  },
  {
    id: 'Studio Vision Pro._remotepairing-manual-pairing._tcp.local',
    name: 'Studio Vision Pro',
    model: 'RealityDevice14,1',
    address: FAKE_VISION_ADDRESS,
    port: 49_152
  }
] as const

/** Each fake device paired by code: its udid, its place on the network, and what its status read says. */
export const fakeCodePaired = {
  'AppleTV14,1': {
    udid: FAKE_TV,
    device: {
      udid: FAKE_TV,
      deviceId: -10,
      connectionType: 'network',
      address: FAKE_TV_ADDRESS,
      pairedByCode: true
    },
    check: {
      info: {
        udid: FAKE_TV,
        name: 'Living Room',
        productType: 'AppleTV14,1',
        productVersion: '26.1',
        buildVersion: '23J582',
        deviceClass: 'AppleTV'
      },
      locked: false,
      developerMode: 'not_required',
      activated: true
    }
  },
  'RealityDevice14,1': {
    udid: FAKE_VISION,
    device: {
      udid: FAKE_VISION,
      deviceId: -11,
      connectionType: 'network',
      address: FAKE_VISION_ADDRESS,
      pairedByCode: true
    },
    check: {
      info: {
        udid: FAKE_VISION,
        name: 'Studio Vision Pro',
        productType: 'RealityDevice14,1',
        productVersion: '26.1',
        buildVersion: '23N301',
        deviceClass: 'RealityDevice'
      },
      locked: false,
      developerMode: 'off',
      activated: true
    }
  }
} as const satisfies Record<
  string,
  { udid: string; device: Device; check: DeviceCheck }
>
