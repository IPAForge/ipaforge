// Development certificates: list, create (with a key that never leaves this computer), revoke, and reuse a
// stored one while Apple still accepts it.

import type { DeveloperContext } from "@apple/application/developer/context.ts";
import {
  type DevelopmentCertificate,
  isUsableCertificate,
  normalizeAppIdName,
  type Team,
} from "@apple/domain/developer.ts";
import { createCertificateRequest } from "@apple/infrastructure/developer/csr.ts";
import { toCertificates, toSubmittedCertificate } from "@apple/infrastructure/developer/parse.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

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

const isIosCertificate = (certificate: DevelopmentCertificate): boolean =>
  certificate.platform === undefined || certificate.platform.toLowerCase() === "ios";

export const listCertificates = async (ctx: DeveloperContext, team: Team): Promise<DevelopmentCertificate[]> =>
  toCertificates(await ctx.teamRequest(team, "listAllDevelopmentCerts"), ctx.skip("certificate")).filter(
    isIosCertificate,
  );

export const createCertificate = async (
  ctx: DeveloperContext,
  team: Team,
  machineName: string,
): Promise<CertificateIdentity> => {
  const name = normalizeAppIdName(machineName);
  const { csrPem, privateKey } = await createCertificateRequest(name);
  const response = await ctx.teamRequest(team, "submitDevelopmentCSR", [
    ["csrContent", csrPem],
    ["machineName", name],
    ["machineId", globalThis.crypto.randomUUID().toUpperCase()],
  ]);
  const submitted = toSubmittedCertificate(response);
  // The submit answer does not include the certificate itself; fetch it from the list.
  const listed = (await listCertificates(ctx, team)).find(
    (certificate) =>
      (submitted.serialNumber && certificate.serialNumber === submitted.serialNumber) ||
      (submitted.id && certificate.id === submitted.id),
  );
  if (!listed?.content) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, { message: "new certificate not found in the list" });
  }
  ctx.deps.logger.info("created development certificate", { team: team.id, machineName: name });
  return { certificate: listed, privateKey };
};

export const revokeCertificate = async (ctx: DeveloperContext, team: Team, serialNumber: string): Promise<void> => {
  await ctx.teamRequest(team, "revokeDevelopmentCert", [["serialNumber", serialNumber]]);
  ctx.deps.logger.info("revoked development certificate", { team: team.id });
};

/** The stored certificate when Apple still lists it and it is usable. */
const reusable = (
  listed: readonly DevelopmentCertificate[],
  stored: CertificateIdentity | undefined,
  now: Date,
): CertificateIdentity | undefined => {
  if (!stored) return undefined;
  const match = listed.find((certificate) => certificate.serialNumber === stored.certificate.serialNumber);
  if (!match || !isUsableCertificate(match, now)) return undefined;
  return { certificate: match, privateKey: stored.privateKey };
};

/** At the limit: lists who made each certificate and when it expires, so the user can choose what to revoke. */
const certificateLimitError = (cause: LoadstarError, listed: readonly DevelopmentCertificate[]): LoadstarError =>
  new LoadstarError(ErrorCode.CertificateLimit, {
    cause,
    data: {
      certificates: listed.map((certificate) => ({
        serialNumber: certificate.serialNumber,
        machineName: certificate.machineName ?? certificate.name ?? "unknown",
        expiresAt: certificate.expiresAt?.toISOString(),
      })),
    },
  });

export const ensureCertificate = async (
  ctx: DeveloperContext,
  team: Team,
  options: EnsureCertificateOptions,
): Promise<CertificateIdentity> => {
  const now = ctx.deps.clock.now();
  const listed = await listCertificates(ctx, team);
  const reused = reusable(listed, options.stored, now);
  if (reused) {
    ctx.deps.logger.debug("reusing development certificate", { team: team.id });
    return reused;
  }
  try {
    return await createCertificate(ctx, team, options.machineName);
  } catch (error) {
    if (error instanceof LoadstarError && error.code === ErrorCode.CertificateLimit) {
      throw certificateLimitError(error, listed);
    }
    throw error;
  }
};
