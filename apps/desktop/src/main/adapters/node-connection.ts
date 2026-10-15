// Node implementation of the device `Connection` port: a net.Socket that can be upgraded to TLS in place.
import type { Buffer } from "node:buffer";
import type { Socket } from "node:net";
import { type PeerCertificate, type TLSSocket, connect as tlsConnect } from "node:tls";
import type { Connection, TlsCredentials } from "@loadstar/device";
import { ErrorCode, equalBytes, LoadstarError } from "@loadstar/kernel";

/**
 * OpenSSL security level for device TLS. Pair records made by older systems sign certificates with SHA-1,
 * which OpenSSL 3 refuses above level 0. This is safe here because the peer is authenticated by pinning
 * its exact certificate (below), not by the strength of the chain.
 */
const DEVICE_TLS_CIPHERS = "DEFAULT:@SECLEVEL=0";
const CLOSE_TIMEOUT_MS = 1000;

type Stream = Socket | TLSSocket;

interface Reader {
  read(): Promise<Uint8Array | null>;
  detach(): void;
}

/** Turns 'data'/'end'/'error' events into pull-based reads, with backpressure via pause/resume. */
const attachReader = (stream: Stream): Reader => {
  const chunks: Uint8Array[] = [];
  const waiters: { resolve: (chunk: Uint8Array | null) => void; reject: (error: unknown) => void }[] = [];
  let ended = false;
  let failure: unknown;

  const onData = (data: Buffer) => {
    const chunk = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(chunk);
    else {
      chunks.push(chunk);
      stream.pause();
    }
  };
  const onEnd = () => {
    ended = true;
    for (const waiter of waiters.splice(0)) waiter.resolve(null);
  };
  const onError = (error: Error) => {
    failure = new LoadstarError(ErrorCode.DeviceDisconnected, { cause: error });
    for (const waiter of waiters.splice(0)) waiter.reject(failure);
  };
  stream.on("data", onData);
  stream.on("end", onEnd);
  stream.on("close", onEnd);
  stream.on("error", onError);

  return {
    read: () => {
      const chunk = chunks.shift();
      if (chunk) {
        if (chunks.length === 0) stream.resume();
        return Promise.resolve(chunk);
      }
      if (failure) return Promise.reject(failure);
      if (ended) return Promise.resolve(null);
      stream.resume();
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    },
    detach: () => {
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("close", onEnd);
      stream.off("error", onError);
      stream.pause();
    },
  };
};

const write = (stream: Stream, bytes: Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(bytes, (error) =>
      error ? reject(new LoadstarError(ErrorCode.DeviceDisconnected, { cause: error })) : resolve(),
    );
  });

const rawCertificate = (certificate: PeerCertificate | undefined): Uint8Array | undefined =>
  certificate?.raw ? new Uint8Array(certificate.raw) : undefined;

/** True when the peer presented exactly the pinned certificate. */
export const matchesPinnedCertificate = (certificate: PeerCertificate | undefined, expected: Uint8Array): boolean => {
  const presented = rawCertificate(certificate);
  return presented !== undefined && equalBytes(presented, expected);
};

/**
 * Upgrades `socket` to TLS and authenticates the device by **pinning**: the handshake must present exactly the
 * device certificate from the pair record, checked before any application byte is sent; anything else is
 * dropped. CA chain validation cannot be used for this peer: lockdown pairing certificates carry empty subject
 * and issuer names (OpenSSL treats them as self-signed) and the device has no hostname, so the pin is the
 * authentication, and it is stricter than a chain because only one exact certificate is accepted.
 */
const upgrade = (socket: Socket, credentials: TlsCredentials): Promise<TLSSocket> =>
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
        fail(
          new LoadstarError(ErrorCode.InvalidPairRecord, {
            message: "the device presented a certificate that does not match its pair record",
          }),
        );
        return;
      }
      resolve(secure);
    });
  });

export const createNodeConnection = (socket: Socket): Connection => {
  let stream: Stream = socket;
  let reader = attachReader(socket);
  return {
    read: () => reader.read(),
    write: (bytes) => write(stream, bytes),
    startTls: async (credentials) => {
      if (stream !== socket) throw new LoadstarError(ErrorCode.DeviceProtocolError, { message: "TLS already active" });
      reader.detach();
      const secure = await upgrade(socket, credentials);
      stream = secure;
      reader = attachReader(secure);
    },
    close: () =>
      new Promise((resolve) => {
        if (stream.destroyed) {
          resolve();
          return;
        }
        // Half-close politely; force it shut if the peer never answers.
        const timer = setTimeout(() => stream.destroy(), CLOSE_TIMEOUT_MS);
        timer.unref();
        stream.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
        stream.end();
      }),
  };
};
