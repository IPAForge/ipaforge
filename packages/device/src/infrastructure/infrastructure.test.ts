import * as pkijs from 'pkijs'
import { describe, expect, it } from 'vitest'

import { createPipe } from '@device/__tests__/fake-device/pipe.ts'
import { DEFAULT_DEVICE_CONFIG } from '@device/domain/config.ts'
import { decodePem, encodePem } from '@device/domain/pairing/pem.ts'
import {
  encodeAfcPacket,
  readAfcPacket,
  splitCStrings
} from '@device/infrastructure/afc/codec.ts'
import { createLink } from '@device/infrastructure/framing/link.ts'
import {
  encodePlistFrame,
  receivePlist
} from '@device/infrastructure/framing/plist-frames.ts'
import { createStreamReader } from '@device/infrastructure/framing/stream-reader.ts'
import { lockdownErrorCode } from '@device/infrastructure/lockdown/errors.ts'
import {
  createPairRecord,
  spkiFromPkcs1
} from '@device/infrastructure/pairing/certificates.ts'
import { preferUsb } from '@device/infrastructure/usbmux/client.ts'
import { toNetworkPort } from '@device/infrastructure/usbmux/protocol.ts'
import {
  createDict,
  ErrorCode,
  IPAForgeError,
  utf8Encode
} from '@ipaforge/kernel'

const LIMITS = {
  maxMessageBytes: DEFAULT_DEVICE_CONFIG.maxMessageBytes,
  plist: DEFAULT_DEVICE_CONFIG.plist
}

const errorCode = async (
  promise: Promise<unknown>
): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) =>
      error instanceof IPAForgeError ? error.code : String(error)
  )

describe('framing', () => {
  it('reads exact lengths across arbitrary chunk boundaries', async () => {
    const pipe = createPipe()
    const reader = createStreamReader(pipe.client)
    for (const chunk of [[1, 2], [3], [], [4, 5, 6, 7]])
      await pipe.server.write(new Uint8Array(chunk))
    expect([...(await reader.readExact(3))]).toEqual([1, 2, 3])
    expect([...(await reader.readExact(4))]).toEqual([4, 5, 6, 7])
    expect(reader.buffered).toBe(0)
  })

  it('reports a connection that ends mid-message', async () => {
    const pipe = createPipe()
    const reader = createStreamReader(pipe.client)
    await pipe.server.write(new Uint8Array([1, 2]))
    await pipe.server.close()
    expect(await errorCode(reader.readExact(4))).toBe(
      ErrorCode.DeviceDisconnected
    )
  })

  it('refuses oversized plist frames before reading them', async () => {
    const pipe = createPipe()
    const link = createLink(pipe.client)
    await pipe.server.write(new Uint8Array([0x7f, 0xff, 0xff, 0xff]))
    expect(await errorCode(receivePlist(link, LIMITS))).toBe(
      ErrorCode.DeviceProtocolError
    )
  })

  it('round-trips plist frames and refuses TLS with unread bytes', async () => {
    const pipe = createPipe()
    const link = createLink(pipe.client)
    const frame = encodePlistFrame(createDict([['Request', 'QueryType']]))
    await pipe.server.write(frame)
    await pipe.server.write(frame)
    expect((await receivePlist(link, LIMITS)).Request).toBe('QueryType')
    await link.reader.readExact(1)
    expect(await errorCode(link.startTls({} as never))).toBe(
      ErrorCode.DeviceProtocolError
    )
  })
})

describe('usbmux', () => {
  it('swaps ports into network byte order', () => {
    expect(toNetworkPort(62078)).toBe(0x7ef2)
    expect(toNetworkPort(toNetworkPort(49152))).toBe(49152)
  })

  it('keeps one entry per device, preferring USB', () => {
    const usb = { udid: 'A', deviceId: 1, connectionType: 'usb' as const }
    const wifi = { udid: 'A', deviceId: 2, connectionType: 'network' as const }
    expect(preferUsb([wifi, usb])).toEqual([usb])
    expect(preferUsb([usb, wifi])).toEqual([usb])
  })
})

describe('lockdown errors', () => {
  it('maps lockdownd errors to catalogued codes', () => {
    expect(lockdownErrorCode('PasswordProtected')).toBe(ErrorCode.DeviceLocked)
    expect(lockdownErrorCode('PairingDialogResponsePending')).toBe(
      ErrorCode.PairingPending
    )
    expect(lockdownErrorCode('UserDeniedPairing')).toBe(ErrorCode.PairingDenied)
    expect(lockdownErrorCode('InvalidHostID')).toBe(ErrorCode.InvalidPairRecord)
    expect(lockdownErrorCode('SomethingNew')).toBe(
      ErrorCode.DeviceProtocolError
    )
  })
})

describe('AFC codec', () => {
  it('round-trips packets and keeps empty values in key/value lists', async () => {
    const pipe = createPipe()
    const link = createLink(pipe.client)
    const packet = {
      operation: 0x10,
      packetNumber: 5n,
      header: new Uint8Array([1, 2]),
      data: utf8Encode('data')
    }
    await pipe.server.write(encodeAfcPacket(packet))
    expect(await readAfcPacket(link, 1024)).toEqual(packet)
    expect(splitCStrings(utf8Encode('a\0\0b\0c\0'))).toEqual([
      'a',
      '',
      'b',
      'c'
    ])
  })

  it('rejects bad magic and impossible lengths', async () => {
    const pipe = createPipe()
    const bad = encodeAfcPacket({
      operation: 1,
      packetNumber: 0n,
      header: new Uint8Array(),
      data: new Uint8Array()
    })
    bad[0] = 0
    await pipe.server.write(bad)
    expect(await errorCode(readAfcPacket(createLink(pipe.client), 1024))).toBe(
      ErrorCode.AfcError
    )

    const pipe2 = createPipe()
    const big = encodeAfcPacket({
      operation: 1,
      packetNumber: 0n,
      header: new Uint8Array(),
      data: new Uint8Array(64)
    })
    await pipe2.server.write(big)
    expect(await errorCode(readAfcPacket(createLink(pipe2.client), 32))).toBe(
      ErrorCode.AfcError
    )
  })
})

describe('pairing certificates', () => {
  const deviceKey = async () => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    )
    const spki = new Uint8Array(
      await crypto.subtle.exportKey('spki', keys.publicKey)
    )
    const pkcs1 = new Uint8Array(
      pkijs.PublicKeyInfo.fromBER(spki.buffer).subjectPublicKey.valueBlock
        .valueHexView
    )

    return { spki, pkcs1 }
  }

  it('wraps PKCS#1 keys into the same SPKI WebCrypto exports', async () => {
    const { spki, pkcs1 } = await deviceKey()
    expect(spkiFromPkcs1(pkcs1)).toEqual(spki)
  })

  it('issues host and device certificates that chain to the new root', async () => {
    const { pkcs1 } = await deviceKey()
    const record = await createPairRecord({
      devicePublicKey: utf8Encode(encodePem('RSA PUBLIC KEY', pkcs1)),
      systemBuid: 'BUID',
      now: new Date('2026-10-15T00:00:00Z')
    })
    const parse = (pem: Uint8Array) =>
      pkijs.Certificate.fromBER(decodePem(pem).der.slice().buffer)
    const root = parse(record.rootCertificate)
    const host = parse(record.hostCertificate)
    const device = parse(record.deviceCertificate)
    expect(await root.verify()).toBe(true)
    expect(await host.verify(root)).toBe(true)
    expect(await device.verify(root)).toBe(true)
    expect(
      new Uint8Array(
        device.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView
      )
    ).toEqual(pkcs1)
    expect(device.notAfter.value.getUTCFullYear()).toBe(2036)
    expect(record.hostId).toMatch(/^[0-9A-F-]{36}$/)
    expect(decodePem(record.hostPrivateKey).label).toBe('PRIVATE KEY')
  })

  it('presents the root itself as the host certificate, so the device has no chain to build', async () => {
    const { pkcs1 } = await deviceKey()
    const record = await createPairRecord({
      devicePublicKey: utf8Encode(encodePem('RSA PUBLIC KEY', pkcs1)),
      systemBuid: 'BUID',
      now: new Date('2026-10-15T00:00:00Z')
    })
    expect(record.hostCertificate).toEqual(record.rootCertificate)
    expect(record.hostPrivateKey).toEqual(record.rootPrivateKey)
  })
})
