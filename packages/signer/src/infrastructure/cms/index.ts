export {
  APPLE_CERTIFICATES,
  type AppleCertificate
} from '@signer/infrastructure/cms/apple-certificates.ts'
export {
  type CertificateInfo,
  certificateInfo,
  parseCertificate
} from '@signer/infrastructure/cms/certificate.ts'
export {
  caIssuerUrls,
  expiringAppleCertificates,
  resolveChain
} from '@signer/infrastructure/cms/chain.ts'
export { signCodeDirectories } from '@signer/infrastructure/cms/sign.ts'
export type {
  ChainResolution,
  IssuerFetcher,
  ResolveChainOptions,
  SignedCodeDirectory,
  SigningIdentity
} from '@signer/infrastructure/cms/types.ts'
