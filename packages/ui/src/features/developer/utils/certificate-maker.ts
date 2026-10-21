import type { CertificateMaker } from '@ui/features/developer/types.ts'
import { isStoredHere } from '@ui/features/developer/utils/is-stored-here.ts'
import { certificateOrigin } from '@ui/features/install/prompts/utils/certificate-origin.ts'
import type { TeamCertificate } from '@ui/services/engine/types.ts'

/**
 * Who made a certificate: IPAForge here (this computer keeps its key), IPAForge elsewhere, SideStore, Xcode, or
 * unknown. One made elsewhere and imported here keeps its maker; it's tagged as this computer's instead.
 */
export const certificateMaker = (
  certificate: Pick<TeamCertificate, 'serialNumber' | 'machineName'>,
  storedSerial: string | undefined
): CertificateMaker => {
  const origin = certificateOrigin({
    ...certificate,
    machineName: certificate.machineName ?? ''
  })

  return origin === 'ipaforge' && isStoredHere(certificate, storedSerial)
    ? 'thisComputer'
    : origin
}
