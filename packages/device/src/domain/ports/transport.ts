/**
 * Host credentials for a TLS session with the device (from the pair record), plus the device certificate
 * the peer must present. The device has no hostname, so the adapter authenticates it by pinning: the
 * presented certificate must be byte-identical to `expectedPeerCertificate`. Verification is never disabled.
 */
export interface TlsCredentials {
  /** Host certificate, PEM. */
  readonly certificatePem: string;
  /** Host private key, PEM (PKCS#1 or PKCS#8). */
  readonly privateKeyPem: string;
  /** Root certificate that issued the host and device certificates, PEM. */
  readonly rootCertificatePem: string;
  /** The pair record's device certificate, DER. */
  readonly expectedPeerCertificate: Uint8Array;
}

/** A byte stream to usbmuxd or, after a usbmux `Connect`, to a port on the device. */
export interface Connection {
  /** The next chunk of bytes, or `null` at end of stream. */
  read(): Promise<Uint8Array | null>;
  write(bytes: Uint8Array): Promise<void>;
  /** Upgrades this connection to TLS in place. Called only when no unread bytes are buffered. */
  startTls(credentials: TlsCredentials): Promise<void>;
  close(): Promise<void>;
}

/** Opens connections to the system usbmuxd (macOS/Linux socket, Windows Apple Mobile Device Service). */
export interface DeviceTransport {
  connectUsbmux(): Promise<Connection>;
}
