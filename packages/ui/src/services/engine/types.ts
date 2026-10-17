// The Engine's data as the UI uses it, named once. Derived from the EngineClient, so the UI never imports the
// packages behind it.
import type {
  EngineClient,
  Prompts,
  RemoteInstallSideStoreInput
} from '@loadstar/rpc'

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
export type Channel = Resolved<'recommendedChannel'>
export type AppIdUsage = Resolved<'appIdQuota'>
export type TeamCertificates = Resolved<'listCertificates'>
export type InstallPlan = Resolved<'planInstall'>
export type SideStoreVariant = RemoteInstallSideStoreInput['variant']
export type InstallSideStoreInput = RemoteInstallSideStoreInput
export type InstallRun = ReturnType<EngineClient['installSideStore']>
export type SignInRun = ReturnType<EngineClient['signIn']>
export type TwoFactorMethods =
  Prompts['apple.two_factor_method']['data']['methods']
export type TwoFactorMethod = Prompts['apple.two_factor_method']['answer']
