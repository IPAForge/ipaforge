// Developer services for a signed-in Apple ID: teams, devices, development certificates, App IDs, app groups and
// provisioning profiles, plus `provisionApp`, which gets everything the signer needs while staying inside the
// free-account limits (App IDs are budgeted before any write; certificates are reused before one is created).

import type { AnisetteService } from "@apple/application/anisette.ts";
import type { AppTokenService } from "@apple/application/app-token.ts";
import type { AppleDeps } from "@apple/deps.ts";
import {
  APP_GROUPS_FEATURE,
  type AppGroup,
  type AppId,
  type AppIdPlan,
  type AppIdQuota,
  type DevelopmentCertificate,
  isUsableCertificate,
  normalizeAppIdName,
  type ProvisioningProfile,
  planAppIds,
  type RegisteredDevice,
  type Team,
} from "@apple/domain/developer.ts";
import type { AppleSession } from "@apple/domain/session.ts";
import {
  type DeveloperPlatform,
  type DeveloperRequestOptions,
  developerRequest,
} from "@apple/infrastructure/developer/client.ts";
import { createCertificateRequest } from "@apple/infrastructure/developer/csr.ts";
import {
  toAppGroup,
  toAppGroups,
  toAppIds,
  toCertificates,
  toCreatedAppId,
  toDevices,
  toProfile,
  toSubmittedCertificate,
  toTeams,
} from "@apple/infrastructure/developer/parse.ts";
import { createDict, ErrorCode, LoadstarError, type PlistValue } from "@loadstar/kernel";

/** A certificate Loadstar created, with the private key that only exists on this computer. */
export interface CertificateIdentity {
  readonly certificate: DevelopmentCertificate;
  /** PKCS#8 DER. */
  readonly privateKey: Uint8Array;
}

export interface EnsureCertificateOptions {
  /** Name Apple shows for the certificate's machine (identifies Loadstar in the revoke picker). */
  readonly machineName: string;
  /** A certificate (and key) saved from an earlier run: reused while Apple still lists it. */
  readonly stored?: CertificateIdentity;
}

export interface BundleRequest {
  /** Bundle identifier after sideload renaming, e.g. `com.SideStore.SideStore.ABCDE12345`. */
  readonly identifier: string;
  readonly name: string;
}

export interface ProvisionRequest {
  readonly team: Team;
  readonly device: { readonly udid: string; readonly name: string };
  /** Main app first, then its extensions. */
  readonly bundles: readonly BundleRequest[];
  /** App group to register and assign to every bundle (e.g. `group.com.SideStore.SideStore.ABCDE12345`). */
  readonly appGroup?: string;
}

export interface ProvisionResult {
  readonly appIds: ReadonlyMap<string, AppId>;
  /** Raw `.mobileprovision` bytes per bundle identifier, for the signer. */
  readonly profiles: ReadonlyMap<string, Uint8Array>;
  readonly plan: AppIdPlan;
}

export interface DeveloperServices {
  teams(): Promise<Team[]>;
  devices(team: Team): Promise<RegisteredDevice[]>;
  /** Registers the device unless it already is. */
  registerDevice(team: Team, udid: string, name: string): Promise<RegisteredDevice>;
  certificates(team: Team): Promise<DevelopmentCertificate[]>;
  createCertificate(team: Team, machineName: string): Promise<CertificateIdentity>;
  revokeCertificate(team: Team, serialNumber: string): Promise<void>;
  /**
   * Reuses the stored certificate while it is still valid on Apple's side; otherwise creates one. At the limit
   * it throws `apple.certificate_limit` with `data.certificates` (who made each one, when it expires) so the
   * user can choose what to revoke.
   */
  ensureCertificate(team: Team, options: EnsureCertificateOptions): Promise<CertificateIdentity>;
  appIds(team: Team): Promise<{ appIds: AppId[]; quota: AppIdQuota }>;
  createAppId(team: Team, identifier: string, name: string): Promise<AppId>;
  deleteAppId(team: Team, appId: AppId): Promise<void>;
  appGroups(team: Team): Promise<AppGroup[]>;
  ensureAppGroup(team: Team, identifier: string): Promise<AppGroup>;
  assignAppGroup(team: Team, appId: AppId, group: AppGroup): Promise<void>;
  profile(team: Team, appId: AppId): Promise<ProvisioningProfile>;
  /** Plans App IDs for `bundles` without changing anything (for the UI's quota display). */
  planAppIds(team: Team, identifiers: readonly string[]): Promise<AppIdPlan>;
  provisionApp(request: ProvisionRequest): Promise<ProvisionResult>;
}

export const createDeveloperServices = (
  deps: AppleDeps,
  anisette: AnisetteService,
  tokens: AppTokenService,
  session: AppleSession,
): DeveloperServices => {
  const { logger, clock } = deps;
  const options: DeveloperRequestOptions = {
    anisette: () => anisette.get(),
    auth: async () => ({ token: (await tokens.appToken(session)).token, adsid: session.adsid }),
  };
  const skip = (what: string) => (entry: unknown) =>
    logger.warn(`skipped a malformed ${what} entry`, {
      keys: entry && typeof entry === "object" ? Object.keys(entry) : [],
    });
  const request = (
    action: string,
    platform: DeveloperPlatform,
    fields: readonly (readonly [string, PlistValue])[] = [],
  ) => developerRequest(deps, options, action, platform, fields);
  const withTeam = (team: Team, fields: readonly (readonly [string, PlistValue])[] = []) =>
    [["teamId", team.id] as const, ...fields] as const;

  const services: DeveloperServices = {
    teams: async () => {
      const teams = toTeams(await request("listTeams", "any"), skip("team"));
      if (teams.length === 0) throw new LoadstarError(ErrorCode.NoTeams);
      return teams;
    },

    devices: async (team) => toDevices(await request("listDevices", "ios", withTeam(team)), skip("device")),

    registerDevice: async (team, udid, name) => {
      const existing = (await services.devices(team)).find(
        (device) => device.udid.toLowerCase() === udid.toLowerCase(),
      );
      if (existing) return existing;
      const response = await request(
        "addDevice",
        "ios",
        withTeam(team, [
          ["deviceNumber", udid],
          ["name", name],
        ]),
      );
      logger.info("registered device", { team: team.id });
      return (
        toDevices(createDict([["devices", [response.device ?? createDict()]]]), skip("device"))[0] ?? { udid, name }
      );
    },

    certificates: async (team) =>
      toCertificates(await request("listAllDevelopmentCerts", "ios", withTeam(team)), skip("certificate")).filter(
        (certificate) => certificate.platform === undefined || certificate.platform.toLowerCase() === "ios",
      ),

    createCertificate: async (team, machineName) => {
      const name = normalizeAppIdName(machineName);
      const { csrPem, privateKey } = await createCertificateRequest(name);
      const response = await request(
        "submitDevelopmentCSR",
        "ios",
        withTeam(team, [
          ["csrContent", csrPem],
          ["machineName", name],
          ["machineId", globalThis.crypto.randomUUID().toUpperCase()],
        ]),
      );
      const submitted = toSubmittedCertificate(response);
      // The submit answer does not include the certificate itself; fetch it from the list.
      const listed = (await services.certificates(team)).find(
        (certificate) =>
          (submitted.serialNumber && certificate.serialNumber === submitted.serialNumber) ||
          (submitted.id && certificate.id === submitted.id),
      );
      if (!listed?.content) {
        throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "new certificate not found in the list" });
      }
      logger.info("created development certificate", { team: team.id, machineName: name });
      return { certificate: listed, privateKey };
    },

    revokeCertificate: async (team, serialNumber) => {
      await request("revokeDevelopmentCert", "ios", withTeam(team, [["serialNumber", serialNumber]]));
      logger.info("revoked development certificate", { team: team.id });
    },

    ensureCertificate: async (team, ensure) => {
      const now = clock.now();
      const listed = await services.certificates(team);
      if (ensure.stored) {
        const match = listed.find(
          (certificate) => certificate.serialNumber === ensure.stored?.certificate.serialNumber,
        );
        if (match && isUsableCertificate(match, now)) {
          logger.debug("reusing development certificate", { team: team.id });
          return { certificate: match, privateKey: ensure.stored.privateKey };
        }
      }
      try {
        return await services.createCertificate(team, ensure.machineName);
      } catch (error) {
        if (error instanceof LoadstarError && error.code === ErrorCode.CertificateLimit) {
          throw new LoadstarError(ErrorCode.CertificateLimit, {
            cause: error,
            data: {
              certificates: listed.map((certificate) => ({
                serialNumber: certificate.serialNumber,
                machineName: certificate.machineName ?? certificate.name ?? "unknown",
                expiresAt: certificate.expiresAt?.toISOString(),
              })),
            },
          });
        }
        throw error;
      }
    },

    appIds: async (team) => toAppIds(await request("listAppIds", "ios", withTeam(team)), skip("App ID")),

    createAppId: async (team, identifier, name) => {
      const response = await request(
        "addAppId",
        "ios",
        withTeam(team, [
          ["identifier", identifier],
          ["name", normalizeAppIdName(name)],
        ]),
      );
      logger.info("created App ID", { identifier });
      return toCreatedAppId(response);
    },

    deleteAppId: async (team, appId) => {
      await request("deleteAppId", "ios", withTeam(team, [["appIdId", appId.id]]));
    },

    appGroups: async (team) =>
      toAppGroups(await request("listApplicationGroups", "ios", withTeam(team)), skip("app group")),

    ensureAppGroup: async (team, identifier) => {
      const existing = (await services.appGroups(team)).find((group) => group.identifier === identifier);
      if (existing) return existing;
      const response = await request(
        "addApplicationGroup",
        "ios",
        withTeam(team, [
          ["identifier", identifier],
          ["name", normalizeAppIdName(identifier)],
        ]),
      );
      return toAppGroup(response);
    },

    assignAppGroup: async (team, appId, group) => {
      if (appId.features[APP_GROUPS_FEATURE] !== true) {
        await request(
          "updateAppId",
          "ios",
          withTeam(team, [
            ["appIdId", appId.id],
            [APP_GROUPS_FEATURE, true],
          ]),
        );
      }
      await request(
        "assignApplicationGroupToAppId",
        "ios",
        withTeam(team, [
          ["appIdId", appId.id],
          ["applicationGroups", group.id],
        ]),
      );
    },

    profile: async (team, appId) =>
      toProfile(await request("downloadTeamProvisioningProfile", "ios", withTeam(team, [["appIdId", appId.id]]))),

    planAppIds: async (team, identifiers) => {
      const { appIds, quota } = await services.appIds(team);
      return planAppIds(identifiers, appIds, quota, clock.now());
    },

    provisionApp: async (provision) => {
      const { team } = provision;
      await services.registerDevice(team, provision.device.udid, provision.device.name);
      const { appIds, quota } = await services.appIds(team);
      const plan = planAppIds(
        provision.bundles.map((bundle) => bundle.identifier),
        appIds,
        quota,
        clock.now(),
      );
      if (!plan.enough) {
        throw new LoadstarError(ErrorCode.AppIdQuotaExceeded, {
          data: {
            needed: plan.create.length,
            available: plan.available,
            ...(plan.nextSlotAt ? { nextSlotAt: plan.nextSlotAt.toISOString() } : {}),
          },
        });
      }
      const byIdentifier = new Map(plan.reuse.map((appId) => [appId.identifier, appId]));
      for (const bundle of provision.bundles) {
        if (!byIdentifier.has(bundle.identifier)) {
          byIdentifier.set(bundle.identifier, await services.createAppId(team, bundle.identifier, bundle.name));
        }
      }
      if (provision.appGroup) {
        const group = await services.ensureAppGroup(team, provision.appGroup);
        for (const appId of byIdentifier.values()) await services.assignAppGroup(team, appId, group);
      }
      const profiles = new Map<string, Uint8Array>();
      for (const [identifier, appId] of byIdentifier)
        profiles.set(identifier, (await services.profile(team, appId)).data);
      logger.info("provisioned app", { bundles: provision.bundles.length, created: plan.create.length });
      return { appIds: byIdentifier, profiles, plan };
    },
  };
  return services;
};
