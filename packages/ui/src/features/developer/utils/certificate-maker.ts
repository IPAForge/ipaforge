import type { CertificateMaker } from '@ui/features/developer/types.ts'
import { certificateOrigin } from '@ui/features/install/prompts/utils/certificate-origin.ts'
import type { TeamCertificate } from '@ui/services/engine/types.ts'

/** Who made a certificate: IPAForge here (this computer keeps its key), IPAForge elsewhere, SideStore, Xcode, or unknown. */
export const certificateMaker = (
  certificate: Pick<TeamCertificate, 'serialNumber' | 'machineName'>,
  storedSerial: string | undefined
): CertificateMaker =>
  certificate.serialNumber.toUpperCase() === storedSerial?.toUpperCase()
    ? 'thisComputer'
    : certificateOrigin({
        ...certificate,
        machineName: certificate.machineName ?? ''
      })
