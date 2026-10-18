import { describe, expect, it } from 'vitest'

import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { PreloadRow } from '@ui/features/preload/home/types.ts'
import {
  linkLabel,
  linkProblem
} from '@ui/features/preload/home/utils/check-link.ts'
import { itemFromFile } from '@ui/features/preload/home/utils/item-from-file.ts'
import { preloadTotals } from '@ui/features/preload/home/utils/preload-totals.ts'
import { rowOf } from '@ui/features/preload/home/utils/row-of.ts'
import type { InstallPlan } from '@ui/services/engine/types.ts'

const item = {
  id: 'app-1',
  label: 'Game.ipa',
  source: { kind: 'file' as const, path: '/a/Game.ipa' }
}

const plan = (overrides: Record<string, unknown> = {}) =>
  ({
    team: { id: 'T', name: 'Me', isFree: true },
    inspection: { app: { name: 'Game', version: '1.0' }, nested: [] },
    appIds: { create: ['a', 'b'], reuse: [], available: 3, enough: true },
    freeSlots: { occupied: [{ bundleId: 'x' }], limit: 3 },
    certificate: { reusable: true },
    ...overrides
  }) as unknown as InstallPlan

const ready = (p: InstallPlan): PreloadRow => ({
  item,
  status: 'ready',
  plan: p
})

describe('rowOf', () => {
  const pending = { data: undefined, error: undefined, isPending: true }

  it('turns away a refused file at once, and waits for the device before asking', () => {
    expect(
      rowOf({ ...item, refused: 'not-ipa' }, pending, true).problem
    ).toEqual({
      kind: 'message',
      key: 'preload.problem.notIpa'
    })
    expect(rowOf(item, pending, false).status).toBe('waiting')
  })

  it('says a link is downloading while it is read', () => {
    const link = {
      ...item,
      source: { kind: 'url' as const, url: 'https://x.com/a.ipa' }
    }
    expect(rowOf(link, pending, true).status).toBe('downloading')
    expect(rowOf(item, pending, true).status).toBe('checking')
  })

  it("words the Engine's refusal and the device's iOS", () => {
    const encrypted = rowOf(
      item,
      {
        data: undefined,
        error: new IPAForgeError(ErrorCode.EncryptedBinary),
        isPending: false
      },
      true
    )
    expect(encrypted.problem).toEqual({
      kind: 'message',
      key: 'errors.signer.encrypted_binary.title',
      detailKey: 'errors.signer.encrypted_binary.body'
    })
    const tooNew = rowOf(
      item,
      {
        data: plan({
          compatibility: {
            code: ErrorCode.UnsupportedIos,
            data: { minimumOSVersion: '27.0', iosVersion: '26.1' }
          }
        }),
        error: undefined,
        isPending: false
      },
      true
    )
    expect(tooNew.problem).toEqual({
      kind: 'needs-ios',
      needs: '27.0',
      has: '26.1'
    })
  })
})

describe('preloadTotals', () => {
  it('adds up new App IDs and free-app slots; an app already installed takes no new slot', () => {
    const totals = preloadTotals([
      ready(plan()),
      ready(
        plan({
          installedVersion: '0.9',
          appIds: { create: [], reuse: ['c'], available: 3, enough: true }
        })
      )
    ])
    expect(totals).toMatchObject({
      apps: 2,
      newAppIds: 2,
      available: 3,
      enough: true,
      freeApps: { used: 1, after: 2, limit: 3 }
    })
  })

  it('is not enough when the apps need more App IDs than are left', () => {
    expect(preloadTotals([ready(plan()), ready(plan())]).enough).toBe(false)
  })

  it('has no limits for a paid team', () => {
    const paid = preloadTotals([
      ready(plan({ team: { id: 'P', name: 'Studio', isFree: false } }))
    ])
    expect(paid.available).toBeUndefined()
    expect(paid.freeApps).toBeUndefined()
    expect(paid.enough).toBe(true)
  })
})

describe('links and files', () => {
  it('takes only https links, named after their file', () => {
    expect(linkProblem('https://example.com/My%20App.ipa')).toBeUndefined()
    expect(linkProblem('http://example.com/a.ipa')).toBe(
      'preload.link.httpsOnly'
    )
    expect(linkProblem('not a link')).toBe('preload.link.invalid')
    expect(linkProblem('https://example.com/AltStore/apps.json')).toBe(
      'preload.link.notIpa'
    )
    expect(linkProblem('https://example.com/App.IPA?token=1')).toBeUndefined()
    expect(linkLabel('https://example.com/My%20App.ipa')).toBe('My App.ipa')
    expect(linkLabel('https://example.com/')).toBe('example.com')
  })

  it('turns away a dropped file that is not an .ipa or has no path', () => {
    expect(itemFromFile({ name: 'a.IPA', size: 1 }, '/x/a.IPA').source).toEqual(
      { kind: 'file', path: '/x/a.IPA' }
    )
    expect(
      itemFromFile({ name: 'notes.txt', size: 1 }, '/x/notes.txt').refused
    ).toBe('not-ipa')
    expect(itemFromFile({ name: 'a.ipa', size: 1 }, undefined).refused).toBe(
      'unreadable'
    )
  })
})
