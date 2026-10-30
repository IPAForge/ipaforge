import { describe, expect, it } from 'vitest'

import { createHarness, scripted } from '@installer/__tests__/harness.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import { ErrorCode } from '@ipaforge/kernel'

const target = {
  id: 'tv._remotepairing-manual-pairing._tcp.local',
  name: 'Living Room',
  model: 'AppleTV14,1',
  address: '192.0.2.20',
  port: 49_152
}

describe('pairByCode', () => {
  it('asks for the code the device shows, and pairs with it', async () => {
    const h = createHarness({ device: { pairingCodes: ['482913'] } })
    const prompts = scripted({ [PromptKind.PairingCode]: () => '482913' })
    const result = await h.engine.pairByCode({ target }, { onPrompt: prompts })
      .result

    expect(result.status === 'completed' && result.state.paired).toEqual({
      udid: 'TV-UDID',
      name: 'Living Room',
      model: 'AppleTV14,1'
    })
    expect(prompts.asked).toEqual([
      {
        kind: PromptKind.PairingCode,
        data: { deviceName: 'Living Room', codeLength: 6, retry: false }
      }
    ])
  })

  it('asks again after a wrong code, saying so, for the new code it shows', async () => {
    const h = createHarness({ device: { pairingCodes: ['482913', '305718'] } })
    const typed = ['111111', '305718']
    const prompts = scripted({
      [PromptKind.PairingCode]: () => typed.shift()
    })
    const result = await h.engine.pairByCode({ target }, { onPrompt: prompts })
      .result

    expect(result.status).toBe('completed')
    expect(prompts.asked.map((prompt) => prompt.data)).toEqual([
      { deviceName: 'Living Room', codeLength: 6, retry: false },
      { deviceName: 'Living Room', codeLength: 6, retry: true }
    ])
  })

  it('ends with the wait the device asks for after too many wrong codes, or when its screen closed', async () => {
    const tooMany = createHarness({
      device: { pairingCodes: ['1', '2', '3'], pairingBackoffAfter: 2 }
    })
    const backoff = await tooMany.engine.pairByCode(
      { target },
      { onPrompt: scripted({ [PromptKind.PairingCode]: () => '000000' }) }
    ).result
    expect(backoff.status === 'failed' && backoff.error).toMatchObject({
      code: ErrorCode.PairingBackoff,
      data: { seconds: 30 }
    })

    const closed = createHarness({ device: { pairingCodes: [] } })
    const gone = await closed.engine.pairByCode({ target }).result
    expect(gone.status === 'failed' && gone.error.code).toBe(
      ErrorCode.PairingScreenClosed
    )
  })
})
