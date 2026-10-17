import { describe, expect, it } from 'vitest'

import { ACCOUNT } from '@installer/__tests__/fakes.ts'
import { createHarness } from '@installer/__tests__/harness.ts'

describe('engine.signOut', () => {
  it('forgets the saved account through the account store', async () => {
    const h = createHarness()
    await h.engine.signOut(ACCOUNT)

    expect(h.apple.calls.removed).toEqual([ACCOUNT])
  })

  it('keeps the signing certificates, so signing in again reuses them', async () => {
    const h = createHarness()
    await h.secrets.set('certificates/key', new Uint8Array([1]))
    await h.engine.signOut(ACCOUNT)

    expect(await h.secrets.get('certificates/key')).toEqual(new Uint8Array([1]))
  })
})
