import type { Socket } from 'node:net'
import {
  createSecureContext,
  type PeerCertificate,
  type TLSSocket,
  connect as tlsConnect
} from 'node:tls'

import type { TlsCredentials } from '@ipaforge/device'
import { compact, ErrorCode, equalBytes, IPAForgeError } from '@ipaforge/kernel'

/**
 * OpenSSL security level for device TLS. Pair records made by older systems sign certificates with SHA-1,
 * which OpenSSL 3 refuses above level 0. This is safe here because the peer is authenticated by pinning
 * its exact certificate (below), not by the strength of the chain.
 */
const DEVICE_TLS_CIPHERS = 'DEFAULT:@SECLEVEL=0'

/**
 * The cipher setting this runtime accepts. Electron's Node is built on BoringSSL, which has no security levels
 * and rejects `@SECLEVEL` (`ERR_SSL_INVALID_COMMAND`); it doesn't need it either, so its defaults are used there.
 * Plain Node (tests, the probes) uses OpenSSL and gets level 0.
 */
export const deviceTlsCiphers = (
  probe: (ciphers: string) => void = (ciphers) => {
    createSecureContext({ ciphers })
  }
): { ciphers?: string } => {
  try {
    probe(DEVICE_TLS_CIPHERS)
    return { ciphers: DEVICE_TLS_CIPHERS }
  } catch {
    return {}
  }
}

let runtimeCiphers: { ciphers?: string } | undefined

const rawCertificate = (
  certificate: PeerCertificate | undefined
): Uint8Array | undefined =>
  certificate?.raw ? new Uint8Array(certificate.raw) : undefined

/** True when the peer presented exactly the pinned certificate. */
export const matchesPinnedCertificate = (
  certificate: PeerCertificate | undefined,
  expected: Uint8Array
): boolean => {
  const presented = rawCertificate(certificate)

  return presented !== undefined && equalBytes(presented, expected)
}

const pinMismatch = () =>
  new IPAForgeError(ErrorCode.InvalidPairRecord, {
    message:
      'the device presented a certificate that does not match its pair record'
  })

/** Fields Node and OpenSSL put on a failed handshake's error. */
type TlsErrorDetails = {
  readonly message?: string
  readonly code?: string
  readonly reason?: string
}

/**
 * A failed handshake, keeping what Node and OpenSSL reported so the failure can be diagnosed. It is a protocol
 * error, not a rejected pair record: pairing again would not fix it.
 */
const handshakeFailed = (error: unknown) => {
  const { message, code, reason } = (error ?? {}) as TlsErrorDetails

  return new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `TLS handshake with the device failed: ${message ?? String(error)}`,
    cause: error,
    data: compact({ tlsError: code, reason })
  })
}

/**
 * Upgrades `socket` to TLS and authenticates the device by **pinning**: the handshake must present exactly the
 * device certificate from the pair record, checked before any application byte is sent; anything else is
 * dropped. CA chain validation cannot be used for this peer: lockdown pairing certificates carry empty subject
 * and issuer names (OpenSSL treats them as self-signed) and the device has no hostname, so the pin is the
 * authentication, and it is stricter than a chain because only one exact certificate is accepted.
 */
export const upgradeToDeviceTls = (
  socket: Socket,
  credentials: TlsCredentials
): Promise<TLSSocket> =>
  new Promise((resolve, reject) => {
    runtimeCiphers ??= deviceTlsCiphers()
    let secure: TLSSocket
    try {
      secure = tlsConnect({
        socket,
        cert: credentials.certificatePem,
        key: credentials.privateKeyPem,
        ca: [credentials.rootCertificatePem],
        ...runtimeCiphers,
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false // replaced by the pin check below
      })
    } catch (error) {
      // Setting up the TLS context failed before any byte was sent (an option this TLS library refuses).
      socket.destroy()
      reject(handshakeFailed(error))
      return
    }
    const fail = (error: unknown) => {
      secure.destroy()
      reject(error instanceof IPAForgeError ? error : handshakeFailed(error))
    }
    secure.once('error', fail)
    secure.once('secureConnect', () => {
      secure.off('error', fail)
      if (
        !matchesPinnedCertificate(
          secure.getPeerCertificate(),
          credentials.expectedPeerCertificate
        )
      ) {
        fail(pinMismatch())
        return
      }
      resolve(secure)
    })
  })
