import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sideStoreCertificateAdditions } from '@installer/sidestore/certificate.ts'
import { createDict, ErrorCode } from '@loadstar/kernel'
import { type CodeBundle, exportPkcs12 } from '@loadstar/signer'

const P12 = new Uint8Array([0x30, 0x82])

vi.mock('@loadstar/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@loadstar/signer')>()),
  exportPkcs12: vi.fn(() => P12)
}))

const certificate = new Uint8Array([1])
const privateKey = new Uint8Array([2])
const input = {
  certificate,
  privateKey,
  serialNumber: '1A2B3C',
  machineId: 'MACHINE-ID'
}
const trust = { kind: 'user-approved' } as const

const bundle = (
  path: string,
  identifier: string,
  kind: CodeBundle['kind']
): CodeBundle => ({
  path,
  kind,
  identifier,
  infoPlist: createDict(),
  executable: `${path}/Exec`,
  depth: path === '' ? 0 : 1
})

const sideStore = [bundle('', 'com.SideStore.SideStore', 'app')]
const liveContainer = [
  bundle(
    'Frameworks/SideStoreApp.framework',
    'com.SideStore.SideStore',
    'framework'
  ),
  bundle('', 'com.kdt.livecontainer', 'app')
]

beforeEach(() => vi.mocked(exportPkcs12).mockClear())

describe('sideStoreCertificateAdditions', () => {
  it('adds ALTCertificate.p12 (password = machineId) and ALTCertificateID to SideStore', () => {
    const [addition, ...rest] = sideStoreCertificateAdditions(
      input,
      trust
    )(sideStore)

    expect(rest).toEqual([])
    expect(addition?.bundlePath).toBe('')
    expect(addition?.files?.get('ALTCertificate.p12')).toBe(P12)
    expect(addition?.infoPlist).toEqual(
      createDict([['ALTCertificateID', '1A2B3C']])
    )
    expect(exportPkcs12).toHaveBeenCalledWith({
      certificate,
      privateKey,
      password: 'MACHINE-ID'
    })
  })

  it('targets the SideStore framework inside LiveContainer', () => {
    const additions = sideStoreCertificateAdditions(input, trust)(liveContainer)
    expect(additions.map((addition) => addition.bundlePath)).toEqual([
      'Frameworks/SideStoreApp.framework'
    ])
  })

  it('adds nothing to other apps, and does not need a machineId for them', () => {
    const other = [bundle('', 'com.example.app', 'app')]
    expect(
      sideStoreCertificateAdditions(
        { ...input, machineId: undefined },
        trust
      )(other)
    ).toEqual([])
    expect(exportPkcs12).not.toHaveBeenCalled()
  })

  it('fails clearly when SideStore needs the certificate but it has no machineId', () => {
    expect(() =>
      sideStoreCertificateAdditions(
        { ...input, machineId: undefined },
        trust
      )(sideStore)
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.CertificateMachineIdMissing })
    )
  })
})
