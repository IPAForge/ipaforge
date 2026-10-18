import type { CertificateChoice } from '@ipaforge/rpc'
import { certificateOriginPatterns } from '@ui/features/install/prompts/constants.ts'
import type { CertificateOrigin } from '@ui/features/install/prompts/types.ts'

/** Who made a certificate: IPAForge, SideStore/AltStore, a named computer (usually Xcode), or unknown. */
export const certificateOrigin = ({
  machineName
}: CertificateChoice): CertificateOrigin => {
  if (!machineName) return 'unknown'
  const known = certificateOriginPatterns.find(([, pattern]) =>
    pattern.test(machineName)
  )

  return known ? known[0] : 'machine'
}
