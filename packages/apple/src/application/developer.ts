// Developer services for a signed-in Apple ID: teams, devices, development certificates, App IDs, app groups and
// provisioning profiles, plus `provisionApp`, which gets everything the signer needs while staying inside the
// free-account limits (App IDs are budgeted before any write; certificates are reused before one is created).

import type { AppTokenService } from '@apple/application/app-token.ts'
import {
  assignAppGroup,
  createAppId,
  deleteAppId,
  downloadProfile,
  ensureAppGroup,
  listAppGroups,
  listAppIds,
  planTeamAppIds
} from '@apple/application/developer/app-ids.ts'
import {
  createCertificate,
  ensureCertificate,
  listCertificates,
  revokeCertificate
} from '@apple/application/developer/certificates.ts'
import { createDeveloperContext } from '@apple/application/developer/context.ts'
import {
  listDevices,
  listTeams,
  registerDevice
} from '@apple/application/developer/devices.ts'
import { provisionApp } from '@apple/application/developer/provision.ts'
import type {
  CertificateIdentity,
  EnsureCertificateOptions,
  ProvisionRequest,
  ProvisionResult
} from '@apple/application/developer/types.ts'
import type { AnisetteService } from '@apple/application/types.ts'
import type {
  AppGroup,
  AppId,
  AppIdPlan,
  AppIdQuota,
  AppleSession,
  DevelopmentCertificate,
  ProvisioningProfile,
  RegisteredDevice,
  Team
} from '@apple/domain/types.ts'
import type { AppleDeps } from '@apple/types.ts'

export type {
  BundleRequest,
  CertificateIdentity,
  EnsureCertificateOptions,
  ProvisionProgress,
  ProvisionRequest,
  ProvisionResult,
  ProvisionTask
} from '@apple/application/developer/types.ts'

export type DeveloperServices = {
  teams(): Promise<Team[]>
  devices(team: Team): Promise<RegisteredDevice[]>
  /** Registers the device unless it already is. */
  registerDevice(
    team: Team,
    udid: string,
    name: string
  ): Promise<RegisteredDevice>
  certificates(team: Team): Promise<DevelopmentCertificate[]>
  createCertificate(
    team: Team,
    machineName: string
  ): Promise<CertificateIdentity>
  revokeCertificate(team: Team, serialNumber: string): Promise<void>
  /**
   * Reuses the stored certificate while it is still valid on Apple's side; otherwise creates one. At the limit
   * it throws `apple.certificate_limit` with `data.certificates` (who made each one, when it expires) so the
   * user can choose what to revoke.
   */
  ensureCertificate(
    team: Team,
    options: EnsureCertificateOptions
  ): Promise<CertificateIdentity>
  appIds(team: Team): Promise<{ appIds: AppId[]; quota: AppIdQuota }>
  createAppId(team: Team, identifier: string, name: string): Promise<AppId>
  deleteAppId(team: Team, appId: AppId): Promise<void>
  appGroups(team: Team): Promise<AppGroup[]>
  ensureAppGroup(team: Team, identifier: string): Promise<AppGroup>
  assignAppGroup(team: Team, appId: AppId, group: AppGroup): Promise<void>
  profile(team: Team, appId: AppId): Promise<ProvisioningProfile>
  /** Plans App IDs for `bundles` without changing anything (for the UI's quota display). */
  planAppIds(team: Team, identifiers: readonly string[]): Promise<AppIdPlan>
  provisionApp(request: ProvisionRequest): Promise<ProvisionResult>
}

export const createDeveloperServices = (
  deps: AppleDeps,
  anisette: AnisetteService,
  tokens: AppTokenService,
  session: AppleSession
): DeveloperServices => {
  const ctx = createDeveloperContext(deps, anisette, tokens, session)

  return {
    teams: () => listTeams(ctx),
    devices: (team) => listDevices(ctx, team),
    registerDevice: (team, udid, name) => registerDevice(ctx, team, udid, name),
    certificates: (team) => listCertificates(ctx, team),
    createCertificate: (team, machineName) =>
      createCertificate(ctx, team, machineName),
    revokeCertificate: (team, serialNumber) =>
      revokeCertificate(ctx, team, serialNumber),
    ensureCertificate: (team, options) => ensureCertificate(ctx, team, options),
    appIds: (team) => listAppIds(ctx, team),
    createAppId: (team, identifier, name) =>
      createAppId(ctx, team, identifier, name),
    deleteAppId: (team, appId) => deleteAppId(ctx, team, appId),
    appGroups: (team) => listAppGroups(ctx, team),
    ensureAppGroup: (team, identifier) => ensureAppGroup(ctx, team, identifier),
    assignAppGroup: (team, appId, group) =>
      assignAppGroup(ctx, team, appId, group),
    profile: (team, appId) => downloadProfile(ctx, team, appId),
    planAppIds: (team, identifiers) => planTeamAppIds(ctx, team, identifiers),
    provisionApp: (request) => provisionApp(ctx, request)
  }
}
