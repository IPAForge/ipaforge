import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PromptKind } from '@ipaforge/rpc'
import { renderAppHook } from '@ui/__tests__/hook-wrapper.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import { FAKE_IPHONE } from '@ui/services/engine/fake/fake-data.ts'

const INPUT = {
  udid: FAKE_IPHONE,
  accountId: 'work@example.com',
  variant: 'sidestore' as const
}

describe('useRun', () => {
  it('turns the run handle into view state: steps, progress, the prompt, the result', async () => {
    const { result } = renderAppHook(useRun, { scenario: 'free-app-limit' })
    expect(result.current.run).toBeUndefined()

    act(() => result.current.start(INPUT))
    await waitFor(() =>
      expect(result.current.run?.view.prompt?.kind).toBe(
        PromptKind.ChooseAppToRemove
      )
    )
    const waiting = result.current.run?.view
    expect(waiting?.steps).toHaveLength(15)
    expect(waiting?.fraction).toBeGreaterThan(0)
    expect(
      waiting?.steps.find((step) => step.id === 'free-apps-0')?.state
    ).toBe('waiting')

    act(() => result.current.answer('com.stik.debug.A1B2C3D4E5'))
    await waitFor(() =>
      expect(result.current.run?.view.status).toBe('completed')
    )
    expect(result.current.run?.view.fraction).toBe(1)

    act(() => result.current.dismiss())
    expect(result.current.run).toBeUndefined()
  })
})
