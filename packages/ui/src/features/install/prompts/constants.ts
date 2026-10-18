import type { CertificateOrigin } from '@ui/features/install/prompts/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** Machine names that say which tool made a certificate; anything else named is a computer (usually Xcode). */
export const certificateOriginPatterns = [
  ['ipaforge', /ipaforge/i],
  ['sidestore', /sidestore|altstore/i]
] as const satisfies readonly (readonly [CertificateOrigin, RegExp])[]

/** A certificate's name in the revoke list, by who made it. */
export const certificateTitleKeys = {
  ipaforge: 'prompts.revoke.ipaforge',
  sidestore: 'prompts.revoke.sidestore',
  machine: 'prompts.revoke.machine',
  unknown: 'prompts.revoke.unknown'
} as const satisfies Record<CertificateOrigin, TranslationKey>

/** What revoking it breaks, said before it is picked; IPAForge's own and unknown ones break nothing known. */
export const certificateWarningKeys = {
  sidestore: 'prompts.revoke.sidestoreWarning',
  machine: 'prompts.revoke.machineWarning'
} as const satisfies Partial<Record<CertificateOrigin, TranslationKey>>

/** What a known app does with the pairing file, by its bundle ID; an unknown app shows its bundle ID. */
export const pairingAppPurposeKeys = {
  'com.SideStore.SideStore': 'prompts.pairing.purpose.sidestore',
  'com.kdt.livecontainer': 'prompts.pairing.purpose.livecontainer',
  'com.stik.stikdebug': 'prompts.pairing.purpose.stikdebug',
  'app.stik.store': 'prompts.pairing.purpose.stikstore'
} as const satisfies Record<string, TranslationKey>
