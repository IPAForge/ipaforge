// The Engine's data as the UI uses it, named once. Derived from the EngineClient, so the UI never imports the
// packages behind it.
import type {
  EngineClient,
  IpaSource,
  Prompts,
  RemoteInstallAppsInput,
  RemoteInstallSideStoreInput
} from '@ipaforge/rpc'

type Resolved<M extends keyof EngineClient> = EngineClient[M] extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never

export type Device = Resolved<'listDevices'>[number]
export type DeviceCheck = Resolved<'deviceStatus'>
export type Account = Resolved<'listAccounts'>[number]
export type Team = Resolved<'listTeams'>[number]
export type CatalogApp = Resolved<'catalogApps'>[number]
export type SourceInfo = Resolved<'listSources'>[number]
export type SourceApps = Resolved<'sourceApps'>[number]
export type SourceApp = SourceApps['apps'][number]
export type SourceAppVersion = SourceApp['versions'][number]
export type SourcePreview = Resolved<'checkSource'>
export type InstalledApp = Resolved<'installedApps'>[number]
export type TeamCertificate =
  Resolved<'listCertificates'>['certificates'][number]
export type TeamAppId = Resolved<'appIdQuota'>['appIds'][number]
export type TeamAppGroup = Resolved<'appGroups'>['groups'][number]
export type TeamDevice = Resolved<'registeredDevices'>['devices'][number]
export type DeviceProfile = Resolved<'deviceProfiles'>[number]
export type AppPairing = Resolved<'pairingFiles'>[number]
export type AnisetteOverview = Resolved<'anisetteServers'>
export type AnisetteServerEntry = AnisetteOverview['servers'][number]
export type AnisetteChoice = AnisetteOverview['choice']
export type AnisetteServerTest = Resolved<'testAnisetteServer'>

/** A catalog app's latest release on one channel. */
export type CatalogRelease = Resolved<'catalogReleases'>[number]

/** Repair SideStore's check: the device's state and SideStore's health. */
export type SideStoreCheck = Resolved<'checkSideStore'>

export type SideStoreHealth = NonNullable<SideStoreCheck['sideStore']>

/** What a refresh does to an installed app: a new profile only, or installed again and why. */
export type RefreshDecision = Resolved<'refreshPlan'>[number]
export type Channel = Resolved<'recommendedChannel'>
export type AppIdUsage = Resolved<'appIdQuota'>
export type TeamCertificates = Resolved<'listCertificates'>
export type InstallPlan = Resolved<'planInstall'>
export type SideStoreVariant = RemoteInstallSideStoreInput['variant']
export type InstallSideStoreInput = RemoteInstallSideStoreInput
export type InstallAppsInput = RemoteInstallAppsInput
/** An app to preload, as the Engine is told where it is: a picked file, a link, or a catalog app. */
export type AppSource = IpaSource
export type InstallRun = ReturnType<EngineClient['installSideStore']>
export type SignInRun = ReturnType<EngineClient['signIn']>
export type TwoFactorMethods =
  Prompts['apple.two_factor_method']['data']['methods']
export type TwoFactorMethod = Prompts['apple.two_factor_method']['answer']
