import { CERTIFICATE_FILE, CERTIFICATE_ID_KEY } from "@installer/sidestore/constants.ts";
import { findSideStoreTarget } from "@installer/sidestore/target.ts";
import type { CertificateTrust } from "@installer/sidestore/trust.ts";
import { createDict, ErrorCode, LoadstarError } from "@loadstar/kernel";
import { type BundleAdditions, exportPkcs12 } from "@loadstar/signer";

/** The development certificate SideStore should hold, as plain data. */
export interface SideStoreCertificate {
  /** DER X.509 certificate. */
  readonly certificate: Uint8Array;
  /** PKCS#8 DER private key. */
  readonly privateKey: Uint8Array;
  readonly serialNumber: string;
  /** Becomes the `.p12` password; Apple returns it with certificates created through its API. */
  readonly machineId?: string | undefined;
}

const requireMachineId = (input: SideStoreCertificate): string => {
  if (input.machineId) return input.machineId;
  throw new LoadstarError(ErrorCode.CertificateMachineIdMissing, {
    message: "the certificate has no machineId, so SideStore could not open its .p12",
    data: { serialNumber: input.serialNumber },
  });
};

/**
 * Additions that give SideStore (or the SideStore inside LiveContainer) the signing certificate, so it can
 * refresh apps by itself: `ALTCertificate.p12` at the target bundle's root and `ALTCertificateID` in its
 * Info.plist. Any other app gets no additions.
 *
 * This hands the private key to the app, so `trust` must say why the IPA is genuine (see CertificateTrust).
 */
export const sideStoreCertificateAdditions =
  (input: SideStoreCertificate, _trust: CertificateTrust): BundleAdditions =>
  (bundles) => {
    const target = findSideStoreTarget(bundles);
    if (!target) return [];
    const p12 = exportPkcs12({
      certificate: input.certificate,
      privateKey: input.privateKey,
      password: requireMachineId(input),
    });
    return [
      {
        bundlePath: target.path,
        files: new Map([[CERTIFICATE_FILE, p12]]),
        infoPlist: createDict([[CERTIFICATE_ID_KEY, input.serialNumber]]),
      },
    ];
  };
