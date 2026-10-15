import type { Socket } from "node:net";
import { type PeerCertificate, type TLSSocket, connect as tlsConnect } from "node:tls";
import type { TlsCredentials } from "@loadstar/device";
import { ErrorCode, equalBytes, LoadstarError } from "@loadstar/kernel";

/**
 * OpenSSL security level for device TLS. Pair records made by older systems sign certificates with SHA-1,
 * which OpenSSL 3 refuses above level 0. This is safe here because the peer is authenticated by pinning
 * its exact certificate (below), not by the strength of the chain.
 */
const DEVICE_TLS_CIPHERS = "DEFAULT:@SECLEVEL=0";

const rawCertificate = (certificate: PeerCertificate | undefined): Uint8Array | undefined =>
  certificate?.raw ? new Uint8Array(certificate.raw) : undefined;

/** True when the peer presented exactly the pinned certificate. */
export const matchesPinnedCertificate = (certificate: PeerCertificate | undefined, expected: Uint8Array): boolean => {
  const presented = rawCertificate(certificate);
  return presented !== undefined && equalBytes(presented, expected);
};

const pinMismatch = () =>
  new LoadstarError(ErrorCode.InvalidPairRecord, {
    message: "the device presented a certificate that does not match its pair record",
  });

/**
 * Upgrades `socket` to TLS and authenticates the device by **pinning**: the handshake must present exactly the
 * device certificate from the pair record, checked before any application byte is sent; anything else is
 * dropped. CA chain validation cannot be used for this peer: lockdown pairing certificates carry empty subject
 * and issuer names (OpenSSL treats them as self-signed) and the device has no hostname, so the pin is the
 * authentication, and it is stricter than a chain because only one exact certificate is accepted.
 */
export const upgradeToDeviceTls = (socket: Socket, credentials: TlsCredentials): Promise<TLSSocket> =>
  new Promise((resolve, reject) => {
    const secure = tlsConnect({
      socket,
      cert: credentials.certificatePem,
      key: credentials.privateKeyPem,
      ca: [credentials.rootCertificatePem],
      ciphers: DEVICE_TLS_CIPHERS,
      minVersion: "TLSv1.2",
      rejectUnauthorized: false, // replaced by the pin check below
    });
    const fail = (error: unknown) => {
      secure.destroy();
      reject(error instanceof LoadstarError ? error : new LoadstarError(ErrorCode.InvalidPairRecord, { cause: error }));
    };
    secure.once("error", fail);
    secure.once("secureConnect", () => {
      secure.off("error", fail);
      if (!matchesPinnedCertificate(secure.getPeerCertificate(), credentials.expectedPeerCertificate)) {
        fail(pinMismatch());
        return;
      }
      resolve(secure);
    });
  });
