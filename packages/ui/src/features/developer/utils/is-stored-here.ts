import type { TeamCertificate } from '@ui/services/engine/types.ts'

/** Whether this computer keeps the certificate's private key: it signs here with it, and can export it. */
export const isStoredHere = (
  certificate: Pick<TeamCertificate, 'serialNumber'>,
  storedSerial: string | undefined
): boolean =>
  certificate.serialNumber.toUpperCase() === storedSerial?.toUpperCase()
