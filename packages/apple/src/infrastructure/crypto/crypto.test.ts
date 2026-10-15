import { describe, expect, it } from 'vitest'

import {
  encryptAppToken,
  encryptSpd,
  srpServer
} from '@apple/__tests__/crypto.ts'
import {
  decryptAppToken,
  decryptSpd
} from '@apple/infrastructure/crypto/session.ts'
import {
  bigintFromBytes,
  bytesFromBigint,
  clientEphemeral,
  clientProof,
  modPow,
  pad,
  passwordKey,
  SRP_N,
  serverProof
} from '@apple/infrastructure/crypto/srp.ts'
import { toHex, utf8Decode, utf8Encode } from '@loadstar/kernel'

/** Miller–Rabin with fixed bases: catches any mistyped digit in the group prime. */
const isProbablePrime = (n: bigint): boolean => {
  let d = n - 1n
  let r = 0
  while (d % 2n === 0n) {
    d /= 2n
    r++
  }
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = modPow(a, d, n)
    if (x === 1n || x === n - 1n) continue
    let composite = true
    for (let i = 1; i < r; i++) {
      x = (x * x) % n
      if (x === n - 1n) {
        composite = false
        break
      }
    }
    if (composite) return false
  }
  return true
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

describe('SRP group', () => {
  it('is the 2048-bit RFC 5054 safe prime', () => {
    expect(SRP_N.toString(2)).toHaveLength(2048)
    expect(isProbablePrime(SRP_N)).toBe(true)
    expect(isProbablePrime((SRP_N - 1n) / 2n)).toBe(true)
  })

  it('encodes big integers minimally and pads on request', () => {
    expect(toHex(bytesFromBigint(0x0102n))).toBe('0102')
    expect(bigintFromBytes(bytesFromBigint(123456789n))).toBe(123456789n)
    expect(pad(1n)).toHaveLength(256)
  })
})

describe('SRP sign-in', () => {
  it('client and server agree on the session key and proofs for the right password', async () => {
    const salt = random(16)
    const key = await passwordKey('correct horse', salt, 1000, 's2k')
    const server = await srpServer(key, salt)
    const ephemeral = clientEphemeral(random)
    const client = await clientProof({
      username: 'user@example.com',
      salt,
      passwordKey: key,
      ephemeral,
      B: server.B
    })
    const verified = await server.verify(
      'user@example.com',
      ephemeral.A,
      client.M1
    )
    expect(verified).toBeDefined()
    expect(verified?.K).toEqual(client.K)
    expect(verified?.M2).toEqual(
      await serverProof(ephemeral.A, client.M1, client.K)
    )
  })

  it('the server rejects a wrong password', async () => {
    const salt = random(16)
    const server = await srpServer(
      await passwordKey('right', salt, 1000, 's2k'),
      salt
    )
    const ephemeral = clientEphemeral(random)
    const client = await clientProof({
      username: 'u',
      salt,
      passwordKey: await passwordKey('wrong', salt, 1000, 's2k'),
      ephemeral,
      B: server.B
    })
    expect(await server.verify('u', ephemeral.A, client.M1)).toBeUndefined()
  })

  it('derives different keys for s2k and s2k_fo', async () => {
    const salt = random(16)
    expect(await passwordKey('pw', salt, 1000, 's2k')).not.toEqual(
      await passwordKey('pw', salt, 1000, 's2k_fo')
    )
  })

  it('refuses B = 0 mod N', async () => {
    await expect(
      clientProof({
        username: 'u',
        salt: random(16),
        passwordKey: random(32),
        ephemeral: clientEphemeral(random),
        B: SRP_N
      })
    ).rejects.toThrow()
  })
})

describe('session data', () => {
  it('decrypts spd and app tokens', async () => {
    const K = random(32)
    expect(
      utf8Decode(
        await decryptSpd(K, await encryptSpd(K, utf8Encode('<plist/>')))
      )
    ).toBe('<plist/>')
    const sk = random(32)
    expect(
      utf8Decode(
        await decryptAppToken(
          sk,
          await encryptAppToken(sk, utf8Encode('token'))
        )
      )
    ).toBe('token')
    await expect(
      decryptAppToken(
        random(32),
        await encryptAppToken(sk, utf8Encode('token'))
      )
    ).rejects.toThrow()
  })
})
