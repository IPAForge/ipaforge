import { z } from 'zod'

import { decodePem, pemText } from '@device/domain/pairing/pem.ts'
import type {
  LockdownPairRecord,
  PairRecord
} from '@device/domain/pairing/types.ts'
import type { TlsCredentials } from '@device/domain/ports/types.ts'
import {
  compact,
  createDict,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  type PlistLimits,
  parsePlist,
  serializeXmlPlist
} from '@loadstar/kernel'

const bytes = z.instanceof(Uint8Array)

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
  UDID: z.string().optional()
})

export const parsePairRecord = (
  data: Uint8Array,
  limits?: PlistLimits
): PairRecord => {
  const value = parsePlist(data, limits)
  const parsed = pairRecordSchema.safeParse(
    isPlistDict(value) ? value : undefined
  )
  if (!parsed.success) {
    throw new LoadstarError(ErrorCode.InvalidPairRecord, {
      message: 'malformed pair record',
      cause: parsed.error
    })
  }
  const r = parsed.data

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
    udid: r.UDID || undefined
  })
}

export const pairRecordToPlist = (record: PairRecord): PlistDict =>
  createDict([
    ['DeviceCertificate', record.deviceCertificate],
    ['HostCertificate', record.hostCertificate],
    ['HostPrivateKey', record.hostPrivateKey],
    ['RootCertificate', record.rootCertificate],
    ['RootPrivateKey', record.rootPrivateKey],
    ['HostID', record.hostId],
    ['SystemBUID', record.systemBuid],
    ...(record.escrowBag ? [['EscrowBag', record.escrowBag] as const] : []),
    ...(record.wifiMacAddress
      ? [['WiFiMACAddress', record.wifiMacAddress] as const]
      : []),
    ...(record.udid ? [['UDID', record.udid] as const] : [])
  ])

export const serializePairRecord = (record: PairRecord): Uint8Array =>
  serializeXmlPlist(pairRecordToPlist(record))

export const lockdownPairRecord = (record: PairRecord): LockdownPairRecord => ({
  deviceCertificate: record.deviceCertificate,
  hostCertificate: record.hostCertificate,
  rootCertificate: record.rootCertificate,
  hostId: record.hostId,
  systemBuid: record.systemBuid
})

/** Host credentials for TLS with the device, pinning the device certificate from this record. */
export const tlsCredentials = (record: PairRecord): TlsCredentials => ({
  certificatePem: pemText(record.hostCertificate),
  privateKeyPem: pemText(record.hostPrivateKey),
  rootCertificatePem: pemText(record.rootCertificate),
  expectedPeerCertificate: decodePem(record.deviceCertificate).der
})

/**
 * The pairing file SideStore (and other apps that talk to lockdownd from the device) import: the whole pair
 * record plus the device's UDID. Those apps refuse a file without `RootPrivateKey` or `WiFiMACAddress`; the root
 * key adds little to what the host private key already grants (a full lockdown session).
 */
export const pairingFile = (record: PairRecord, udid: string): Uint8Array =>
  serializeXmlPlist(pairRecordToPlist({ ...record, udid }))
