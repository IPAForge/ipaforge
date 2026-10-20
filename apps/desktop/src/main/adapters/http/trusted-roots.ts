// Trust for HTTPS: the standard Node roots, the certificates the OS trusts, and Apple Root CA. Apple's own services
// (gsa.apple.com, developer services) use certificates from Apple's private CA, which public root stores do not
// include. The OS's certificates cover a company proxy that inspects HTTPS, or a self-hosted anisette server with
// its own CA, that its user has added to the system's store.
import { getCACertificates, rootCertificates } from 'node:tls'

import { encodePem } from '@ipaforge/device'
import { fromBase64 } from '@ipaforge/kernel'
import { APPLE_CERTIFICATES } from '@ipaforge/signer'

const appleRoots = APPLE_CERTIFICATES.filter(
  (certificate) => certificate.kind === 'root'
).map((certificate) => encodePem('CERTIFICATE', fromBase64(certificate.der)))

/** The certificates the OS trusts (keychain, Windows store, /etc/ssl); none if they can't be read. */
export const systemCertificates = (): readonly string[] => {
  try {
    return getCACertificates('system')
  } catch {
    return []
  }
}

/** Node's bundled roots, the OS's certificates and Apple's roots, each once. */
export const TRUSTED_ROOTS: readonly string[] = [
  ...new Set([...rootCertificates, ...systemCertificates(), ...appleRoots])
]
