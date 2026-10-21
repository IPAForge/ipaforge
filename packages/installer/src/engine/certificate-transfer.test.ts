import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  certificateFor,
  FREE_TEAM
} from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'
import { createCertificateStore } from '@installer/application/certificate-store.ts'
import { ErrorCode, IPAForgeError, silentLogger } from '@ipaforge/kernel'

// The .p12 itself is the signer's (tested there); here it opens with "sidestore" to a key for certificate SERIAL1.
vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30, 0x01])),
  importPkcs12: vi.fn((_bytes: Uint8Array, password: string) => {
    if (password !== 'sidestore')
      throw new IPAForgeError(ErrorCode.Pkcs12Password)
    return { serialNumber: 'SERIAL1', privateKey: new Uint8Array([9]) }
  }),
  keyMatchesCertificate: vi.fn(
    (_key: Uint8Array, certificate: Uint8Array) => certificate[1] !== 0
  )
}))

const QUERY = { accountId: ACCOUNT, teamId: FREE_TEAM.id }
const P12 = new Uint8Array([0x30])

describe('certificates as .p12', () => {
  it('imports a certificate Apple lists for the team, and signs with it here from then on', async () => {
    const h = createHarness({
      apple: { existingCertificates: [certificateFor('SERIAL1')] }
    })

    expect(await h.engine.importCertificate(QUERY, P12, 'sidestore')).toEqual({
      serialNumber: 'SERIAL1'
    })
    expect((await h.engine.listCertificates(QUERY)).storedSerial).toBe(
      'SERIAL1'
    )
    expect(h.apple.calls.created).toEqual([])
  })

  it('refuses a wrong password, a certificate the team doesn’t have, and a key that isn’t its own', async () => {
    const h = createHarness({
      apple: {
        existingCertificates: [
          { ...certificateFor('SERIAL1'), content: new Uint8Array([0x30, 0]) }
        ]
      }
    })
    const other = createHarness()

    await expect(
      h.engine.importCertificate(QUERY, P12, 'wrong')
    ).rejects.toMatchObject({ code: ErrorCode.Pkcs12Password })
    await expect(
      other.engine.importCertificate(QUERY, P12, 'sidestore')
    ).rejects.toMatchObject({ code: ErrorCode.CertificateNotOnTeam })
    await expect(
      h.engine.importCertificate(QUERY, P12, 'sidestore')
    ).rejects.toMatchObject({ code: ErrorCode.InvalidCertificate })
    expect(
      (await h.engine.listCertificates(QUERY)).storedSerial
    ).toBeUndefined()
  })

  it('exports this computer’s certificate, and says when it keeps none for the team', async () => {
    const h = createHarness({
      apple: { existingCertificates: [certificateFor('SERIAL1')] }
    })

    await expect(
      h.engine.exportCertificate(QUERY, 'secret')
    ).rejects.toMatchObject({ code: ErrorCode.CertificateNotStored })

    await createCertificateStore(h.secrets, silentLogger).save(
      ACCOUNT,
      FREE_TEAM.id,
      {
        certificate: certificateFor('SERIAL1'),
        privateKey: new Uint8Array([7])
      }
    )
    expect(await h.engine.exportCertificate(QUERY, 'secret')).toEqual(
      new Uint8Array([0x30, 0x01])
    )
  })
})
