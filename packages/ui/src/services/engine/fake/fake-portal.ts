// The Developer Portal page for the fake Engine: the team's certificates (IPAForge's signs the fake apps), App IDs
// (one per installed app and extension, plus one nothing uses), app groups, registered devices, and the profiles
// on the device (one expired that nothing uses). Revoking, deleting and removing change what it answers next.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { Engine, TeamQuery } from '@ipaforge/rpc'
import {
  FAKE_IPHONE,
  fakeCertificates,
  PERSONAL_TEAM
} from '@ui/services/engine/fake/fake-data.ts'
import type { Team } from '@ui/services/engine/types.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const STORED_SERIAL = 'FAKECERT01'
/** The team suffix the fake's installed apps carry. */
const APPS_TEAM = 'FAKETEAM01'
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS)

type PortalQueries = Pick<
  Engine,
  | 'listCertificates'
  | 'appIdQuota'
  | 'revokeCertificate'
  | 'deleteAppId'
  | 'appGroups'
  | 'registeredDevices'
  | 'deviceProfiles'
  | 'removeDeviceProfiles'
>

/** The bundle ids of the fake's installed apps and their extensions, as sideloaded for the team. */
const APP_BUNDLES = [
  `com.SideStore.SideStore.${APPS_TEAM}`,
  `com.SideStore.SideStore.${APPS_TEAM}.AltWidget`,
  `com.google.ios.youtube.${APPS_TEAM}`,
  `com.kdt.livecontainer.beta.${APPS_TEAM}`,
  `com.stik.stikdebug.${APPS_TEAM}`,
  `com.example.mygame.${APPS_TEAM}`
]
const UNUSED_BUNDLE = `com.example.oldgame.${APPS_TEAM}`

export const createFakePortal = (
  teamOf: (query: TeamQuery) => Team,
  wait: () => Promise<void>
): PortalQueries => {
  let certificates = fakeCertificates.slice(0, 2).map((certificate) => ({
    ...certificate,
    expiresAt: new Date(certificate.expiresAt)
  }))
  const appIdsFor = () =>
    [...APP_BUNDLES, UNUSED_BUNDLE].map((bundle, index) => ({
      id: `APPID${index}`,
      identifier: bundle,
      name: bundle.replace(`.${APPS_TEAM}`, ''),
      features: {},
      expiresAt: inDays(index + 1)
    }))
  const deleted = new Set<string>()
  let profiles = [
    ...APP_BUNDLES.map((bundle, index) => ({
      uuid: `PROFILE-${index}`,
      name: `iOS Team Provisioning Profile: ${bundle}`,
      teamId: PERSONAL_TEAM.id,
      bundleId: bundle,
      expiresAt: inDays(6),
      isUsed: true
    })),
    {
      uuid: 'PROFILE-OLD',
      name: `iOS Team Provisioning Profile: ${UNUSED_BUNDLE}`,
      teamId: PERSONAL_TEAM.id,
      bundleId: UNUSED_BUNDLE,
      expiresAt: inDays(-2),
      isUsed: false
    }
  ]

  return {
    listCertificates: async (query) => ({
      team: teamOf(query),
      certificates,
      storedSerial: STORED_SERIAL
    }),
    appIdQuota: async (query) => {
      const team = teamOf(query)
      const appIds = appIdsFor().filter((appId) => !deleted.has(appId.id))

      return {
        team,
        appIds: team.isFree
          ? appIds
          : appIds.map(({ expiresAt: _, ...appId }) => appId),
        quota: team.isFree ? { max: 10, available: 8 } : { available: 0 }
      }
    },
    revokeCertificate: async (query, serialNumber) => {
      teamOf(query)
      await wait()
      certificates = certificates.filter(
        (certificate) => certificate.serialNumber !== serialNumber
      )
    },
    deleteAppId: async (query, appIdId) => {
      teamOf(query)
      if (!appIdsFor().some((appId) => appId.id === appIdId))
        throw new IPAForgeError(ErrorCode.AppIdUnavailable)
      await wait()
      deleted.add(appIdId)
    },
    appGroups: async (query) => {
      const team = teamOf(query)

      return {
        team,
        groups: [
          {
            id: 'GROUP1',
            identifier: `group.com.SideStore.SideStore.${team.id}`,
            name: 'SideStore'
          },
          {
            id: 'GROUP2',
            identifier: `group.com.kdt.livecontainer.${team.id}`,
            name: 'LiveContainer'
          }
        ]
      }
    },
    registeredDevices: async (query) => ({
      team: teamOf(query),
      devices: [
        { id: 'DEVICE1', udid: FAKE_IPHONE, name: 'iPhone' },
        { id: 'DEVICE2', udid: '00008112-000A1B2C3D4E7A2E', name: 'iPad' }
      ]
    }),
    deviceProfiles: async () => profiles,
    removeDeviceProfiles: async (_udid, uuids) => {
      await wait()
      profiles = profiles.filter((profile) => !uuids.includes(profile.uuid))
    }
  }
}
