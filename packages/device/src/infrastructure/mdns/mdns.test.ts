import { describe, expect, it } from 'vitest'

import { lockdownAdvert, ptrData } from '@device/__tests__/mdns-answer.ts'
import type { Datagram, MulticastSocket } from '@device/domain/ports/types.ts'
import { authTagMatches } from '@device/infrastructure/mdns/auth-tag.ts'
import { browseWifiDevices } from '@device/infrastructure/mdns/browser.ts'
import {
  RecordType,
  WIFI_LOCKDOWN_SERVICE
} from '@device/infrastructure/mdns/constants.ts'
import {
  decodeMessage,
  encodeQuery
} from '@device/infrastructure/mdns/message.ts'
import type { BrowseEvent } from '@device/infrastructure/mdns/types.ts'
import { ErrorCode, IPAForgeError, silentLogger } from '@ipaforge/kernel'

const ADVERT = {
  mac: '02:00:00:00:00:01',
  host: 'iPhone.local',
  address: '192.0.2.10',
  txt: [
    'identifier=0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D',
    'authTag=dr5/vaK9kIw='
  ]
}

describe('mDNS messages', () => {
  it('encodes a query for the lockdown-over-Wi-Fi service', () => {
    const query = encodeQuery(
      [{ name: WIFI_LOCKDOWN_SERVICE, type: RecordType.PTR }],
      0x12_34
    )
    expect([...query.subarray(0, 12)]).toEqual([
      0x12, 0x34, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0
    ])
    expect(new TextDecoder().decode(query.subarray(12, 27))).toBe(
      '\u000e_apple-mobdev2'
    )
    expect([...query.subarray(-4)]).toEqual([0, RecordType.PTR, 0, 1])
  })

  it("reads a device's whole advert: PTR, SRV, TXT and A", () => {
    const message = decodeMessage(lockdownAdvert(ADVERT, 7))
    expect(message.id).toBe(7)
    expect(message.isResponse).toBe(true)
    expect(message.records.map((record) => record.type)).toEqual([
      RecordType.PTR,
      RecordType.SRV,
      RecordType.TXT,
      RecordType.A
    ])
    expect(message.records[1]).toMatchObject({
      port: 32498,
      target: 'iPhone.local'
    })
    expect(message.records[2]).toMatchObject({ entries: ADVERT.txt })
    expect(message.records[3]).toMatchObject({ address: '192.0.2.10' })
  })

  it('follows name compression, and refuses a pointer loop', () => {
    // One question, then one answer whose name is a pointer (0xc00c) back to the question's name.
    const query = encodeQuery(
      [{ name: WIFI_LOCKDOWN_SERVICE, type: RecordType.PTR }],
      0
    )
    const target = ptrData('a.b')
    const pointed = new Uint8Array([
      ...[0, 0, 0x84, 0, 0, 1, 0, 1, 0, 0, 0, 0],
      ...query.subarray(12),
      ...[0xc0, 12, 0, RecordType.PTR, 0, 1, 0, 0, 0, 120, 0, target.length],
      ...target
    ])
    expect(decodeMessage(pointed).records).toEqual([
      {
        name: WIFI_LOCKDOWN_SERVICE,
        ttl: 120,
        type: RecordType.PTR,
        target: 'a.b'
      }
    ])

    const loop = new Uint8Array([
      0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0xc0, 12
    ])
    expect(() => decodeMessage(loop)).toThrow(IPAForgeError)
  })
})

describe('authTag', () => {
  // The vector was computed with Python's hmac and hashlib, independently of this code.
  const HOST_ID = '5F0B6C2A-1D3E-4F5A-8B9C-0D1E2F3A4B5C'
  const IDENTIFIER = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D'

  it("matches the tag a device sends for this computer's HostID", async () => {
    expect(await authTagMatches(HOST_ID, IDENTIFIER, 'dr5/vaK9kIw=')).toBe(true)
  })

  it("refuses another computer's tag, another identifier and a broken tag", async () => {
    expect(await authTagMatches('another', IDENTIFIER, 'dr5/vaK9kIw=')).toBe(
      false
    )
    expect(await authTagMatches(HOST_ID, 'another', 'dr5/vaK9kIw=')).toBe(false)
    expect(await authTagMatches(HOST_ID, IDENTIFIER, '***')).toBe(false)
  })

  it('refuses a tag of any length but 8 bytes, even one that starts the right way', async () => {
    // The first byte of the real tag, alone: it would match a check that compared only what it was given.
    expect(await authTagMatches(HOST_ID, IDENTIFIER, 'dg==')).toBe(false)
    expect(await authTagMatches(HOST_ID, IDENTIFIER, 'dr5/vaK9kIwA')).toBe(
      false
    )
  })
})

/** A socket on a fake network: each query is answered at once with `answers()`. */
const fakeSocket = (answers: () => Uint8Array[], deny = false) => {
  const listeners = new Set<(datagram: Datagram) => void>()
  let sent = 0
  const socket: MulticastSocket = {
    send: async () => {
      if (deny) throw new IPAForgeError(ErrorCode.LocalNetworkDenied)
      sent++
      for (const bytes of answers())
        for (const listener of [...listeners])
          listener({ bytes, from: '192.0.2.10' })
    },
    onMessage: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: async () => listeners.clear()
  }

  return { socket, sent: () => sent }
}

const browse = async (
  socket: MulticastSocket,
  rounds: number,
  onRound: (round: number) => void = () => {}
) => {
  const events: BrowseEvent[] = []
  const controller = new AbortController()
  let now = 0
  let round = 0
  await browseWifiDevices(
    socket,
    {
      logger: silentLogger,
      intervalMs: 1000,
      now: () => now,
      sleep: async () => {
        now += 1000
        round++
        onRound(round)
        if (round >= rounds) controller.abort()
      }
    },
    (event) => events.push(event),
    controller.signal
  )
  return events
}

describe('searching the network', () => {
  it('finds a device once, with its address, MAC and TXT values', async () => {
    const { socket, sent } = fakeSocket(() => [lockdownAdvert(ADVERT)])
    const events = await browse(socket, 2)
    expect(events).toEqual([
      {
        kind: 'found',
        advert: {
          instance: `${ADVERT.mac}@fe80::1-supportsRP-24.${WIFI_LOCKDOWN_SERVICE}`,
          address: '192.0.2.10',
          mac: ADVERT.mac,
          identifier: '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D',
          authTags: ['dr5/vaK9kIw=']
        }
      }
    ])
    expect(sent()).toBe(2)
  })

  it('loses a device on its goodbye, or after three silent rounds', async () => {
    let answer = lockdownAdvert(ADVERT)
    const goodbye = fakeSocket(() => [answer])
    const said = await browse(goodbye.socket, 2, () => {
      answer = lockdownAdvert({ ...ADVERT, ttl: 0 })
    })
    expect(said.map((event) => event.kind)).toEqual(['found', 'lost'])

    let isThere = true
    const silent = fakeSocket(() => (isThere ? [lockdownAdvert(ADVERT)] : []))
    const quiet = await browse(silent.socket, 6, () => {
      isThere = false
    })
    expect(quiet.map((event) => event.kind)).toEqual(['found', 'lost'])
  })

  it('stops with local_network_denied when the OS refuses the search', async () => {
    const { socket } = fakeSocket(() => [], true)
    await expect(browse(socket, 1)).rejects.toMatchObject({
      code: ErrorCode.LocalNetworkDenied
    })
  })
})
