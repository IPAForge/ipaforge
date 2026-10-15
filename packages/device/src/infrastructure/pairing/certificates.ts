// Creates a new pair record: a root CA, a host certificate and a device certificate over the device's own
// public key, the way a desktop pairs with an iPhone. Platform-free (WebCrypto + pkijs).

import type { PairRecord } from "@device/domain/pairing/pair-record.ts";
import { decodePem, pemBytes } from "@device/domain/pairing/pem.ts";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

const OID_RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";
const OID_KEY_USAGE = "2.5.29.15";
const OID_SUBJECT_KEY_IDENTIFIER = "2.5.29.14";

const RSA_KEY_BITS = 2048;
const RSA_PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);
const SIGNATURE_HASH = "SHA-256";
const VALIDITY_YEARS = 10;

/** keyUsage bits (X.509 BIT STRING, first byte): digitalSignature | keyEncipherment; keyCertSign | cRLSign. */
const KEY_USAGE_END_ENTITY = { bits: 0xa0, unusedBits: 5 };
const KEY_USAGE_CA = { bits: 0x06, unusedBits: 1 };

export interface CreatePairRecordInput {
  /** `DevicePublicKey` from lockdownd: PEM, PKCS#1 ("RSA PUBLIC KEY") or SPKI ("PUBLIC KEY"). */
  readonly devicePublicKey: Uint8Array;
  readonly systemBuid: string;
  readonly now: Date;
  readonly hostId?: string;
  readonly crypto?: Crypto;
}

const toBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Wraps a PKCS#1 RSAPublicKey into a SubjectPublicKeyInfo. */
export const spkiFromPkcs1 = (pkcs1: Uint8Array): Uint8Array =>
  new Uint8Array(
    new asn1js.Sequence({
      value: [
        new asn1js.Sequence({ value: [new asn1js.ObjectIdentifier({ value: OID_RSA_ENCRYPTION }), new asn1js.Null()] }),
        new asn1js.BitString({ valueHex: toBuffer(pkcs1) }),
      ],
    }).toBER(false),
  );

const devicePublicKeyInfo = (pem: Uint8Array): pkijs.PublicKeyInfo => {
  const { label, der } = decodePem(pem);
  const spki = label === "RSA PUBLIC KEY" ? spkiFromPkcs1(der) : der;
  return pkijs.PublicKeyInfo.fromBER(toBuffer(spki));
};

const extension = (extnID: string, critical: boolean, value: asn1js.AsnType) =>
  new pkijs.Extension({ extnID, critical, extnValue: value.toBER(false) });

const keyUsage = ({ bits, unusedBits }: { bits: number; unusedBits: number }) =>
  new asn1js.BitString({ valueHex: new Uint8Array([bits]).buffer, unusedBits });

const subjectKeyIdentifier = async (crypto: Crypto, info: pkijs.PublicKeyInfo): Promise<asn1js.OctetString> => {
  const key = new Uint8Array(info.subjectPublicKey.valueBlock.valueHexView);
  return new asn1js.OctetString({ valueHex: await crypto.subtle.digest("SHA-1", key) });
};

const addYears = (date: Date, years: number): Date => {
  const out = new Date(date);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
};

const generateKeyPair = (crypto: Crypto): Promise<CryptoKeyPair> =>
  crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: RSA_KEY_BITS,
      publicExponent: RSA_PUBLIC_EXPONENT,
      hash: SIGNATURE_HASH,
    },
    true,
    ["sign", "verify"],
  );

const issue = async (options: {
  crypto: Crypto;
  serial: number;
  publicKey: pkijs.PublicKeyInfo;
  issuerKey: CryptoKey;
  ca: boolean;
  now: Date;
}): Promise<Uint8Array> => {
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: options.serial });
  // Lockdown pairings carry empty subject and issuer names; the root signs both leaves.
  cert.subject = new pkijs.RelativeDistinguishedNames();
  cert.issuer = new pkijs.RelativeDistinguishedNames();
  cert.notBefore.value = options.now;
  cert.notAfter.value = addYears(options.now, VALIDITY_YEARS);
  cert.subjectPublicKeyInfo = options.publicKey;
  cert.extensions = [
    extension(OID_BASIC_CONSTRAINTS, true, new pkijs.BasicConstraints({ cA: options.ca }).toSchema()),
    extension(OID_KEY_USAGE, true, keyUsage(options.ca ? KEY_USAGE_CA : KEY_USAGE_END_ENTITY)),
    extension(OID_SUBJECT_KEY_IDENTIFIER, false, await subjectKeyIdentifier(options.crypto, options.publicKey)),
  ];
  await cert.sign(options.issuerKey, SIGNATURE_HASH, new pkijs.CryptoEngine({ crypto: options.crypto }));
  return new Uint8Array(cert.toSchema(true).toBER(false));
};

const publicKeyInfo = async (crypto: Crypto, key: CryptoKey): Promise<pkijs.PublicKeyInfo> =>
  pkijs.PublicKeyInfo.fromBER(await crypto.subtle.exportKey("spki", key));

const privateKeyPem = async (crypto: Crypto, key: CryptoKey): Promise<Uint8Array> =>
  pemBytes("PRIVATE KEY", new Uint8Array(await crypto.subtle.exportKey("pkcs8", key)));

export const createPairRecord = async (input: CreatePairRecordInput): Promise<PairRecord> => {
  const crypto = input.crypto ?? globalThis.crypto;
  const [root, host] = await Promise.all([generateKeyPair(crypto), generateKeyPair(crypto)]);
  const rootInfo = await publicKeyInfo(crypto, root.publicKey);
  const hostInfo = await publicKeyInfo(crypto, host.publicKey);
  const base = { crypto, issuerKey: root.privateKey, now: input.now };

  const [rootCertificate, hostCertificate, deviceCertificate] = await Promise.all([
    issue({ ...base, serial: 1, publicKey: rootInfo, ca: true }),
    issue({ ...base, serial: 2, publicKey: hostInfo, ca: false }),
    issue({ ...base, serial: 3, publicKey: devicePublicKeyInfo(input.devicePublicKey), ca: false }),
  ]);

  return {
    deviceCertificate: pemBytes("CERTIFICATE", deviceCertificate),
    hostCertificate: pemBytes("CERTIFICATE", hostCertificate),
    hostPrivateKey: await privateKeyPem(crypto, host.privateKey),
    rootCertificate: pemBytes("CERTIFICATE", rootCertificate),
    rootPrivateKey: await privateKeyPem(crypto, root.privateKey),
    hostId: input.hostId ?? crypto.randomUUID().toUpperCase(),
    systemBuid: input.systemBuid,
  };
};
