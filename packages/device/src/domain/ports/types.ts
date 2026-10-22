/**
 * Host credentials for a TLS session with the device (from the pair record), plus the device certificate
 * the peer must present. The device has no hostname, so the adapter authenticates it by pinning: the
 * presented certificate must be byte-identical to `expectedPeerCertificate`. Verification is never disabled.
 */
export type TlsCredentials = {
  /** Host certificate, PEM. */
  readonly certificatePem: string
  /** Host private key, PEM (PKCS#1 or PKCS#8). */
  readonly privateKeyPem: string
  /** Root certificate that issued the host and device certificates, PEM. */
  readonly rootCertificatePem: string
  /** The pair record's device certificate, DER. */
  readonly expectedPeerCertificate: Uint8Array
}

/** A byte stream to usbmuxd or, after a usbmux `Connect`, to a port on the device. */
export type Connection = {
  /** The next chunk of bytes, or `null` at end of stream. */
  read(): Promise<Uint8Array | null>
  write(bytes: Uint8Array): Promise<void>
  /** Upgrades this connection to TLS in place. Called only when no unread bytes are buffered. */
  startTls(credentials: TlsCredentials): Promise<void>
  close(): Promise<void>
}

/** A datagram the network sent back, and the address it came from. */
export type Datagram = {
  readonly bytes: Uint8Array
  readonly from: string
}

/**
 * A UDP socket for finding devices on the local network (mDNS): it sends to the mDNS multicast group and hears
 * the answers sent back to it. It uses a port of its own, never 5353, so it never competes with the system's
 * Bonjour or avahi. `send` throws `device.local_network_denied` when the OS refuses local network access.
 */
export type MulticastSocket = {
  send(bytes: Uint8Array): Promise<void>
  /** Calls `listener` with every datagram that arrives; the returned function stops it. */
  onMessage(listener: (datagram: Datagram) => void): () => void
  close(): Promise<void>
}

/**
 * Opens connections to the system usbmuxd (macOS/Linux socket, Windows Apple Mobile Device Service) and, when the
 * host can, straight to a device on the local network: TCP to its Wi-Fi address, and the socket that finds it.
 */
export type DeviceTransport = {
  connectUsbmux(): Promise<Connection>
  connectTcp?(host: string, port: number): Promise<Connection>
  openMulticast?(): Promise<MulticastSocket>
}
