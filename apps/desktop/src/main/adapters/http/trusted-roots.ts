// Trust for HTTPS: the standard Node roots plus Apple Root CA. Apple's own services (gsa.apple.com, developer
// services) use certificates from Apple's private CA, which public root stores do not include.
import { rootCertificates } from "node:tls";
import { encodePem } from "@loadstar/device";
import { fromBase64 } from "@loadstar/kernel";
import { APPLE_CERTIFICATES } from "@loadstar/signer";

const appleRoots = APPLE_CERTIFICATES.filter((certificate) => certificate.kind === "root").map((certificate) =>
  encodePem("CERTIFICATE", fromBase64(certificate.der)),
);

/** Node's bundled roots plus Apple's roots. */
export const TRUSTED_ROOTS: readonly string[] = [...rootCertificates, ...appleRoots];
