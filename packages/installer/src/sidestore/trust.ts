// Why Loadstar may hand the signing certificate and its private key to an IPA. The IPA's bundle ID proves
// nothing on its own: any IPA can claim to be SideStore, so the caller must state where the IPA came from.

export type CertificateTrust =
  /** A catalog release whose download matched its published SHA-256. */
  | { readonly kind: "catalog"; readonly appId: string; readonly sha256: string }
  /** A manually imported IPA, after the user explicitly agreed to share the certificate with it. */
  | { readonly kind: "user-approved" };
