import { describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT,
  certificateFor,
  FREE_TEAM,
  installedApp,
  profile,
  session,
  UDID
} from '@installer/__tests__/fakes.ts'
import {
  createHarness,
  type HarnessOptions,
  scripted
} from '@installer/__tests__/harness.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import type { RunEvent } from '@installer/engine/types.ts'
import type { StepDetail } from '@installer/pipeline/types.ts'

vi.mock('@ipaforge/signer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ipaforge/signer')>()),
  exportPkcs12: vi.fn(() => new Uint8Array([0x30]))
}))

const input = { udid: UDID, accountId: ACCOUNT, variant: 'sidestore' as const }

type Detailed = { stepId: string; detail: StepDetail }

/** Runs installSideStore and returns every step detail it reported, in order. */
const detailsOf = async (
  harness: ReturnType<typeof createHarness>,
  answers: Parameters<typeof scripted>[0] = {}
): Promise<Detailed[]> => {
  const details: Detailed[] = []
  const run = harness.engine.installSideStore(input, {
    onPrompt: scripted(answers)
  })
  run.subscribe((event: RunEvent) => {
    if (event.type === 'step-detail')
      details.push({ stepId: event.stepId, detail: event.detail })
  })
  expect((await run.result).status).toBe('completed')
  return details
}

const detailOf = async (
  options: HarnessOptions,
  stepId: string,
  answers: Parameters<typeof scripted>[0] = {}
): Promise<StepDetail[]> =>
  (await detailsOf(createHarness(options), answers))
    .filter((entry) => entry.stepId === stepId)
    .map((entry) => entry.detail)

describe('step details', () => {
  it('reports what each step of installSideStore did', async () => {
    const details = await detailsOf(createHarness())
    expect(details).toEqual([
      {
        stepId: 'device',
        detail: { kind: 'device', productType: 'iPhone1,1', iosVersion: '18.0' }
      },
      {
        stepId: 'resolve-0',
        detail: { kind: 'release', version: '1.0', channel: 'stable' }
      },
      {
        stepId: 'download-0',
        detail: { kind: 'download', bytes: 2, cached: false }
      },
      {
        stepId: 'inspect-0',
        detail: { kind: 'app', name: 'App', extensions: 0 }
      },
      { stepId: 'sign-in', detail: { kind: 'session', how: 'reused' } },
      {
        stepId: 'team',
        detail: { kind: 'team', name: FREE_TEAM.name, isFree: true }
      },
      {
        stepId: 'register-device',
        detail: { kind: 'device-registration', isNew: true }
      },
      {
        stepId: 'certificate',
        detail: { kind: 'certificate', how: 'created' }
      },
      {
        stepId: 'app-ids',
        detail: { kind: 'app-ids', created: 1, reused: 0, left: 9 }
      },
      {
        stepId: 'free-apps-0',
        detail: { kind: 'free-apps', used: 0, limit: 3 }
      },
      { stepId: 'provision-0', detail: { kind: 'profiles', count: 1 } },
      { stepId: 'sign-0', detail: { kind: 'signed', bundles: 1 } },
      {
        stepId: 'install-0',
        detail: { kind: 'install-phase', phase: 'uploading' }
      },
      {
        stepId: 'install-0',
        detail: { kind: 'install-phase', phase: 'installing' }
      },
      { stepId: 'pairing', detail: { kind: 'pairing', apps: ['App'] } }
    ])
  })

  it('tells a renewed session from a reused one, and from a password the user typed', async () => {
    const renewed = { ...session, idmsToken: 'renewed' }
    expect(
      await detailOf(
        {
          apple: {
            resume: async () => ({ kind: 'signed_in', session: renewed })
          }
        },
        'sign-in'
      )
    ).toEqual([{ kind: 'session', how: 'renewed' }])
    expect(
      await detailOf(
        {
          apple: {
            savedSession: null,
            resume: async () => ({ kind: 'needs_password', appleId: ACCOUNT })
          }
        },
        'sign-in',
        { [PromptKind.Password]: () => 'secret' }
      )
    ).toEqual([{ kind: 'session', how: 'signed-in' }])
  })

  it('says the certificate was reused on the next run', async () => {
    const h = createHarness()
    await detailsOf(h)
    const second = await detailsOf(h)
    expect(
      second.find((entry) => entry.stepId === 'certificate')?.detail
    ).toEqual({ kind: 'certificate', how: 'reused' })
  })

  it('says the certificate replaced one the user revoked', async () => {
    expect(
      await detailOf(
        {
          apple: {
            existingCertificates: [certificateFor('OLD1')],
            maxCertificates: 1
          }
        },
        'certificate',
        { [PromptKind.RevokeCertificate]: () => 'OLD1' }
      )
    ).toEqual([{ kind: 'certificate', how: 'replaced' }])
  })

  it('says the device was registered already', async () => {
    expect(
      await detailOf(
        { apple: { registeredDevices: [UDID] } },
        'register-device'
      )
    ).toEqual([{ kind: 'device-registration', isNew: false }])
  })

  it('counts App IDs created, reused and left', async () => {
    expect(
      await detailOf(
        {
          apple: {
            appIdPlan: {
              create: [],
              reuse: [{ identifier: 'x' } as never],
              available: 4
            }
          }
        },
        'app-ids'
      )
    ).toEqual([{ kind: 'app-ids', created: 0, reused: 1, left: 4 }])
  })

  it('reports the free-app slots in use and the app removed to make room', async () => {
    const apps = ['com.a', 'com.b', 'com.c']
    expect(
      await detailOf(
        {
          device: {
            profiles: apps.map((id, i) => profile(`P${i}`, FREE_TEAM.id, id)),
            installed: new Map(
              apps.map((id) => [id, installedApp(id, id.toUpperCase())])
            )
          }
        },
        'free-apps-0',
        { [PromptKind.ChooseAppToRemove]: () => 'com.b' }
      )
    ).toEqual([{ kind: 'free-apps', used: 2, limit: 3, removed: 'COM.B' }])
  })
})
