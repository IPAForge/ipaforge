import { decodePem, pemText } from "@device/domain/pairing/pem.ts";
import type { TlsCredentials } from "@device/domain/ports/transport.ts";
import {
  compact,
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistLimits,
  parsePlist,
  serializeXmlPlist,
} from "@loadstar/kernel";
import { z } from "zod";

/** The pair record fields lockdownd's `Pair`/`ValidatePair` expect (certificates as PEM bytes). */
export interface LockdownPairRecord {
  readonly deviceCertificate: Uint8Array;
  readonly hostCertificate: Uint8Array;
  readonly rootCertificate: Uint8Array;
  readonly hostId: string;
  readonly systemBuid: string;
}

/** A host↔device pairing. Certificates and keys are PEM bytes, exactly as usbmuxd and lockdownd store them. */
export interface PairRecord {
  readonly deviceCertificate: Uint8Array;
  readonly hostCertificate: Uint8Array;
  readonly hostPrivateKey: Uint8Array;
  readonly rootCertificate: Uint8Array;
  readonly rootPrivateKey: Uint8Array;
  readonly hostId: string;
  readonly systemBuid: string;
  readonly escrowBag?: Uint8Array;
  readonly wifiMacAddress?: string;
  readonly udid?: string;
}

const bytes = z.instanceof(Uint8Array);

const pairRecordSchema = z.looseObject({
  DeviceCertificate: bytes,
  HostCertificate: bytes,
  HostPrivateKey: bytes,
  RootCertificate: bytes,
  RootPrivateKey: bytes,
  HostID: z.string().min(1),
  SystemBUID: z.string().min(1),
  EscrowBag: bytes.optional(),
  WiFiMACAddress: z.string().optional(),
  UDID: z.string().optional(),
});

export const parsePairRecord = (data: Uint8Array, limits?: PlistLimits): PairRecord => {
  const value = parsePlist(data, limits);
  const parsed = pairRecordSchema.safeParse(isPlistDict(value) ? value : undefined);
  if (!parsed.success) {
    throw new LoadstarError(ErrorCode.InvalidPairRecord, { message: "malformed pair record", cause: parsed.error });
  }
  const r = parsed.data;
  return compact({
    deviceCertificate: r.DeviceCertificate,
    hostCertificate: r.HostCertificate,
    hostPrivateKey: r.HostPrivateKey,
    rootCertificate: r.RootCertificate,
    rootPrivateKey: r.RootPrivateKey,
    hostId: r.HostID,
    systemBuid: r.SystemBUID,
    escrowBag: r.EscrowBag,
    // Empty strings count as missing.
    wifiMacAddress: r.WiFiMACAddress || undefined,
    udid: r.UDID || undefined,
  });
};

export const pairRecordToPlist = (record: PairRecord): PlistDict =>
  createDict([
    ["DeviceCertificate", record.deviceCertificate],
    ["HostCertificate", record.hostCertificate],
    ["HostPrivateKey", record.hostPrivateKey],
    ["RootCertificate", record.rootCertificate],
    ["RootPrivateKey", record.rootPrivateKey],
    ["HostID", record.hostId],
    ["SystemBUID", record.systemBuid],
    ...(record.escrowBag ? [["EscrowBag", record.escrowBag] as const] : []),
    ...(record.wifiMacAddress ? [["WiFiMACAddress", record.wifiMacAddress] as const] : []),
    ...(record.udid ? [["UDID", record.udid] as const] : []),
  ]);

export const serializePairRecord = (record: PairRecord): Uint8Array => serializeXmlPlist(pairRecordToPlist(record));

export const lockdownPairRecord = (record: PairRecord): LockdownPairRecord => ({
  deviceCertificate: record.deviceCertificate,
  hostCertificate: record.hostCertificate,
  rootCertificate: record.rootCertificate,
  hostId: record.hostId,
  systemBuid: record.systemBuid,
});

/** Host credentials for TLS with the device, pinning the device certificate from this record. */
export const tlsCredentials = (record: PairRecord): TlsCredentials => ({
  certificatePem: pemText(record.hostCertificate),
  privateKeyPem: pemText(record.hostPrivateKey),
  rootCertificatePem: pemText(record.rootCertificate),
  expectedPeerCertificate: decodePem(record.deviceCertificate).der,
});

/**
 * The pairing file SideStore (and other apps that talk to lockdownd from the device) import: the pair record
 * plus the device's UDID, **without the root private key**. Apps only need the host identity to connect;
 * the root key could mint new host certificates, so it never leaves this computer.
 */
export const pairingFile = (record: PairRecord, udid: string): Uint8Array => {
  const { RootPrivateKey: _root, ...withoutRootKey } = pairRecordToPlist({ ...record, udid });
  return serializeXmlPlist(createDict(Object.entries(withoutRootKey)));
};
