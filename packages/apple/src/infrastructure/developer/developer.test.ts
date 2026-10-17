import * as pkijs from 'pkijs'
import { describe, expect, it } from 'vitest'

import { resolveAppleDeps } from '@apple/deps.ts'
import type { AnisetteData } from '@apple/domain/types.ts'
import {
  developerRequest,
  developerUrl
} from '@apple/infrastructure/developer/client.ts'
import { createCertificateRequest } from '@apple/infrastructure/developer/csr.ts'
import {
  toAppIds,
  toCertificates,
  toTeams
} from '@apple/infrastructure/developer/parse.ts'
import {
  createDict,
  ErrorCode,
  fromBase64,
  type HttpRequest,
  isPlistDict,
  type PlistDict,
  parsePlist,
  serializeXmlPlist
} from '@loadstar/kernel'

const anisette: AnisetteData = {
  headers: {
    'X-Mme-Device-Id': 'dev',
    'X-Apple-I-MD': 'md',
    'X-Apple-I-MD-M': 'mdm',
    'X-Apple-I-TimeZone': 'UTC'
  },
  identity: { clientInfo: '<client>', userAgent: 'agent' },
  server: 'test',
  serverAddress: 'https://ani.test'
}

/** A fake HttpClient answering every request with `answer` and recording what was sent. */
const recordingDeps = (answer: PlistDict, status = 200) => {
  const sent: HttpRequest[] = []
  const deps = resolveAppleDeps({
    http: {
      request: async (request) => {
        sent.push(request)
        const body = serializeXmlPlist(answer)

        return {
          status,
          headers: {},
          body: new ReadableStream({
            start: (controller) => {
              controller.enqueue(body)
              controller.close()
            }
          })
        }
      }
    },
    webSocket: () => {
      throw new Error('unused')
    },
    secrets: {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {}
    }
  })
  const options = {
    anisette: async () => anisette,
    auth: async () => ({ token: 'gs-token', adsid: 'adsid-1' })
  }

  return { deps, options, sent }
}

describe('developer client', () => {
  it('builds the URL per platform', () => {
    expect(developerUrl('listTeams', 'any')).toBe(
      'https://developerservices2.apple.com/services/QH65B2/listTeams.action?clientId=XABBG36SBA'
    )
    expect(developerUrl('listAppIds', 'ios')).toContain(
      '/QH65B2/ios/listAppIds.action'
    )
  })

  it('sends the envelope, token, adsid and only the cpd anisette headers', async () => {
    const { deps, options, sent } = recordingDeps(
      createDict([['resultCode', 0]])
    )
    await developerRequest(deps, options, 'listDevices', 'ios', [
      ['teamId', 'TEAM1']
    ])
    const request = sent[0] as HttpRequest
    expect(request.headers?.['X-Apple-GS-Token']).toBe('gs-token')
    expect(request.headers?.['X-Apple-I-Identity-Id']).toBe('adsid-1')
    expect(request.headers?.['X-Apple-I-MD']).toBe('md')
    expect(request.headers?.['X-Apple-I-TimeZone']).toBeUndefined()
    const body = parsePlist(request.body as Uint8Array)
    expect(isPlistDict(body) && body.clientId).toBe('XABBG36SBA')
    expect(isPlistDict(body) && body.teamId).toBe('TEAM1')
    expect(isPlistDict(body) && String(body.requestId)).toMatch(
      /^[0-9A-F-]{36}$/
    )
  })

  it('turns resultCode into catalogued errors and 401/403 into session/eligibility errors', async () => {
    const limit = recordingDeps(
      createDict([
        ['resultCode', 7460],
        ['userString', 'too many certificates']
      ])
    )
    await expect(
      developerRequest(limit.deps, limit.options, 'submitDevelopmentCSR', 'ios')
    ).rejects.toMatchObject({
      code: ErrorCode.CertificateLimit
    })
    const expired = recordingDeps(createDict(), 401)
    await expect(
      developerRequest(expired.deps, expired.options, 'listAppIds', 'ios')
    ).rejects.toMatchObject({
      code: ErrorCode.SessionExpired
    })
    const refused = recordingDeps(createDict(), 403)
    await expect(
      developerRequest(refused.deps, refused.options, 'listTeams', 'any')
    ).rejects.toMatchObject({
      code: ErrorCode.NotEligibleForDevelopment
    })
  })
})

describe('response parsing', () => {
  const skip = () => {}

  it('clamps negative and missing App ID quantities to zero', () => {
    expect(
      toAppIds(
        createDict([
          ['appIds', []],
          ['availableQuantity', -1],
          ['maxQuantity', 10]
        ]),
        skip
      ).quota
    ).toEqual({
      max: 10,
      available: 0
    })
    expect(toAppIds(createDict([['appIds', []]]), skip).quota.available).toBe(0)
  })

  it('skips malformed entries instead of failing the list', () => {
    const skipped: unknown[] = []
    const certificates = toCertificates(
      createDict([
        [
          'certificates',
          [
            createDict([
              ['serialNumber', 'AB12'],
              ['machineName', 'Loadstar'],
              ['certificatePlatform', 'ios']
            ]),
            createDict([['name', 'no serial']])
          ]
        ]
      ]),
      (entry) => skipped.push(entry)
    )
    expect(certificates.map((certificate) => certificate.machineName)).toEqual([
      'Loadstar'
    ])
    expect(skipped).toHaveLength(1)
  })

  it('detects free (personal) teams', () => {
    const teams = toTeams(
      createDict([
        [
          'teams',
          [
            createDict([
              ['teamId', 'FREE1'],
              ['name', 'Dan'],
              [
                'memberships',
                [createDict([['name', 'Xcode Free Provisioning Program']])]
              ]
            ]),
            createDict([
              ['teamId', 'PAID1'],
              ['name', 'Company'],
              [
                'memberships',
                [createDict([['name', 'Apple Developer Program']])]
              ]
            ])
          ]
        ]
      ]),
      skip
    )
    expect(teams.map((team) => [team.id, team.isFree])).toEqual([
      ['FREE1', true],
      ['PAID1', false]
    ])
  })
})

describe('certificate signing request', () => {
  it('is a valid, self-signed PKCS#10 request with the machine name as CN', async () => {
    const { csrPem, privateKey } = await createCertificateRequest('Loadstar')
    expect(csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----\n/)
    const der = fromBase64(csrPem.replace(/-----[A-Z ]+-----|\s+/g, ''))
    const request = pkijs.CertificationRequest.fromBER(der.slice().buffer)
    expect(await request.verify()).toBe(true)
    const cn = request.subject.typesAndValues.find(
      (entry) => entry.type === '2.5.4.3'
    )
    expect(cn?.value.valueBlock.value).toBe('Loadstar')
    expect(privateKey.byteLength).toBeGreaterThan(1000)
  })
})
