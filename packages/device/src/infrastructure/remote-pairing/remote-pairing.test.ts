// Remote pairing against a fake device that plays the device's side: pair-setup end to end, the device's
// signature checked, pair-verify accepted and refused, and the wire pieces (frames, TLV8, OPACK).
import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it, vi } from 'vitest'

import {
  createFakeRemoteDevice,
  DEVICE_ALT_IRK,
  DEVICE_ID
} from '@device/__tests__/fake-remote-device.ts'
import {
  decodeOpack,
  encodeOpack
} from '@device/domain/remote-pairing/opack.ts'
import { decodeTlv8, encodeTlv8 } from '@device/domain/remote-pairing/tlv8.ts'
import type { HostIdentity } from '@device/domain/remote-pairing/types.ts'
import { createLink } from '@device/infrastructure/framing/link.ts'
import {
  createPairingChannel,
  encodeFrame
} from '@device/infrastructure/remote-pairing/channel.ts'
import { createEncryptedChannel } from '@device/infrastructure/remote-pairing/encrypted-channel.ts'
import { pairSetup } from '@device/infrastructure/remote-pairing/pair-setup.ts'
import { pairVerify } from '@device/infrastructure/remote-pairing/pair-verify.ts'
import { ErrorCode, utf8Decode } from '@ipaforge/kernel'

const randomBytes = (length: number) =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

const hostIdentity = (): HostIdentity => {
  const privateKey = ed25519.utils.randomSecretKey()

  return {
    identifier: '7D2A5C1E-1111-4222-8333-944455556666',
    privateKey,
    publicKey: ed25519.getPublicKey(privateKey),
    name: 'IPAForge-7d2a5c',
    model: 'computer',
    altIrk: randomBytes(16),
    mac: randomBytes(6),
    serialNumber: 'IPAForge'
  }
}

describe('remote pair-setup', () => {
  it("pairs with the USB PIN and keeps the device's identity and identity resolving key", async () => {
    const device = createFakeRemoteDevice()
    const host = hostIdentity()
    const { record } = await pairSetup(device.channel, { host, randomBytes })

    expect(record.deviceIdentifier).toBe(DEVICE_ID)
    expect(record.devicePublicKey).toEqual(device.devicePublicKey)
    expect(record.altIrk).toEqual(DEVICE_ALT_IRK)
    expect(record.identifier).toBe(host.identifier)
    expect(device.known.get(host.identifier)).toEqual(host.publicKey)
  })

  it('numbers the frames and starts a new session only with M1', async () => {
    const device = createFakeRemoteDevice()
    const channel = device.channel
    await pairSetup(channel, { host: hostIdentity(), randomBytes })
    const starts = device.sent
      .map(
        (body) =>
          JSON.stringify(body).match(/"startNewSession":(true|false)/)?.[1]
      )
      .filter(Boolean)

    expect(starts).toEqual(['true', 'false', 'false'])
  })

  it('says when the device shows a prompt, and goes on once the user answers', async () => {
    const device = createFakeRemoteDevice({ asksConsent: true })
    const onAwaitingConsent = vi.fn()
    await pairSetup(device.channel, {
      host: hostIdentity(),
      randomBytes,
      onAwaitingConsent
    })

    expect(onAwaitingConsent).toHaveBeenCalledTimes(1)
  })

  it("passes on the device's refusal with its reason", async () => {
    const device = createFakeRemoteDevice({ rejectWith: 'User denied pairing' })

    await expect(
      pairSetup(device.channel, { host: hostIdentity(), randomBytes })
    ).rejects.toMatchObject({
      code: ErrorCode.PairingDenied,
      data: { reason: 'User denied pairing' }
    })
  })

  it('pairs an Apple TV with the code it shows, asked once it shows it, and keeps what it says it is', async () => {
    const device = createFakeRemoteDevice({
      pin: '482913',
      model: 'AppleTV14,1',
      name: 'Living Room'
    })
    const askPin = vi.fn(async () => {
      // The code is asked for after M1 was sent and answered: the device shows it by then.
      expect(device.sent).toHaveLength(2)
      return '482913'
    })
    const { record, peer } = await pairSetup(device.channel, {
      host: hostIdentity(),
      randomBytes,
      askPin
    })

    expect(askPin).toHaveBeenCalledTimes(1)
    expect(record.altIrk).toEqual(DEVICE_ALT_IRK)
    expect(peer).toEqual({
      udid: 'UDID',
      name: 'Living Room',
      model: 'AppleTV14,1'
    })
  })

  it('says a typed code is wrong, or how long to wait after too many', async () => {
    const wrong = createFakeRemoteDevice({ pin: '482913' })
    await expect(
      pairSetup(wrong.channel, {
        host: hostIdentity(),
        randomBytes,
        askPin: async () => '111111'
      })
    ).rejects.toMatchObject({ code: ErrorCode.PairingCodeWrong })

    const tooMany = createFakeRemoteDevice({
      pin: '482913',
      backoffSeconds: 30
    })
    await expect(
      pairSetup(tooMany.channel, {
        host: hostIdentity(),
        randomBytes,
        askPin: async () => '111111'
      })
    ).rejects.toMatchObject({
      code: ErrorCode.PairingBackoff,
      data: { seconds: 30 }
    })
  })

  it('refuses to pair by code with a device that asks to be allowed instead of showing a code', async () => {
    const device = createFakeRemoteDevice({ asksConsent: true })
    const askPin = vi.fn(async () => '123456')

    await expect(
      pairSetup(device.channel, { host: hostIdentity(), randomBytes, askPin })
    ).rejects.toMatchObject({ code: ErrorCode.DeviceProtocolError })
    expect(askPin).not.toHaveBeenCalled()
  })

  it("refuses a device whose signature doesn't match its identity", async () => {
    const device = createFakeRemoteDevice({ badSignature: true })

    await expect(
      pairSetup(device.channel, { host: hostIdentity(), randomBytes })
    ).rejects.toMatchObject({ code: ErrorCode.DeviceProtocolError })
  })
})

describe('remote pair-verify', () => {
  it('is accepted by the device that pairing was made with, sharing its secret', async () => {
    const device = createFakeRemoteDevice()
    const { record } = await pairSetup(device.channel, {
      host: hostIdentity(),
      randomBytes
    })

    const secret = await pairVerify(device.channel, {
      record,
      hostName: 'IPAForge',
      randomBytes
    })
    expect(secret).toEqual(device.shared())
  })

  it('then sends requests encrypted, and opens the encrypted answer', async () => {
    const device = createFakeRemoteDevice({ listenerPort: 51_234 })
    const { record } = await pairSetup(device.channel, {
      host: hostIdentity(),
      randomBytes
    })
    const secret = await pairVerify(device.channel, {
      record,
      hostName: 'IPAForge',
      randomBytes
    })
    const encrypted = createEncryptedChannel(device.channel, secret)

    const first = await encrypted.request({
      request: { _0: { createListener: {} } }
    })
    const second = await encrypted.request({
      request: { _0: { createListener: {} } }
    })
    expect(first).toMatchObject({
      response: { _1: { createListener: { port: 51_234 } } }
    })
    expect(second).toEqual(first)
    expect(device.encrypted).toHaveLength(2)
  })

  it('is refused once the device forgot this computer', async () => {
    const device = createFakeRemoteDevice({ forgetsHost: true })
    const { record } = await pairSetup(device.channel, {
      host: hostIdentity(),
      randomBytes
    })

    await expect(
      pairVerify(device.channel, { record, hostName: 'IPAForge', randomBytes })
    ).rejects.toMatchObject({ code: ErrorCode.PairingDenied })
  })

  it('refuses another device answering for it', async () => {
    const first = createFakeRemoteDevice()
    const { record } = await pairSetup(first.channel, {
      host: hostIdentity(),
      randomBytes
    })
    const other = createFakeRemoteDevice()

    await expect(
      pairVerify(other.channel, {
        record: { ...record, devicePublicKey: other.devicePublicKey },
        hostName: 'IPAForge',
        randomBytes
      })
    ).rejects.toMatchObject({ code: ErrorCode.PairingDenied })
  })
})

describe('remote pairing wire format', () => {
  it('frames JSON as RPPairing, a big-endian length and the body, and reads it back', async () => {
    const frame = encodeFrame({
      message: { plain: { _0: { hello: 1 } } },
      originatedBy: 'device',
      sequenceNumber: 0
    })
    expect(utf8Decode(frame.subarray(0, 9))).toBe('RPPairing')
    expect(new DataView(frame.buffer).getUint16(9)).toBe(frame.byteLength - 11)

    const chunks = [frame.subarray(0, 5), frame.subarray(5)]
    const link = createLink({
      read: async () => chunks.shift() ?? null,
      write: async () => {},
      startTls: async () => {},
      close: async () => {}
    })
    expect(await createPairingChannel(link).receive()).toEqual({ hello: 1 })
  })

  it('splits TLV8 values over 255 bytes and joins them again', () => {
    const long = randomBytes(600)
    const encoded = encodeTlv8([
      [3, long],
      [6, new Uint8Array([1])]
    ])
    const decoded = decodeTlv8(encoded)

    expect(encoded.byteLength).toBe(600 + 3 * 2 + 3)
    expect(decoded.get(3)).toEqual(long)
    expect(decoded.get(6)).toEqual(new Uint8Array([1]))
  })

  it('round-trips OPACK dictionaries with strings, data, integers and nested values', () => {
    const value = {
      accountID: 'A-B-C',
      altIRK: randomBytes(16),
      long: 'x'.repeat(300),
      small: 7,
      big: 70_000,
      flags: [true, false, null],
      nested: { data: randomBytes(40) }
    }

    expect(decodeOpack(encodeOpack(value))).toEqual(value)
  })
})
