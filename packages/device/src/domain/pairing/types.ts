/** The pair record fields lockdownd's `Pair`/`ValidatePair` expect (certificates as PEM bytes). */
export type LockdownPairRecord = {
  readonly deviceCertificate: Uint8Array
  readonly hostCertificate: Uint8Array
  readonly rootCertificate: Uint8Array
  readonly hostId: string
  readonly systemBuid: string
}

/** A host↔device pairing. Certificates and keys are PEM bytes, exactly as usbmuxd and lockdownd store them. */
export type PairRecord = {
  readonly deviceCertificate: Uint8Array
  readonly hostCertificate: Uint8Array
  readonly hostPrivateKey: Uint8Array
  readonly rootCertificate: Uint8Array
  readonly rootPrivateKey: Uint8Array
  readonly hostId: string
  readonly systemBuid: string
  readonly escrowBag?: Uint8Array
  readonly wifiMacAddress?: string
  readonly udid?: string
}
