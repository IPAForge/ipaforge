/** Apple issues RSA development certificates; IPAForge's keys come from `@ipaforge/apple` as PKCS#8. */
export const KEY_ALGORITHM = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256'
} as const

/** Share of the step each signer stage reaches; bundle signing fills the span between them. */
export const SIGN_PROGRESS = {
  reconciling: 0.1,
  signingEnd: 0.9,
  writing: 0.95
} as const
