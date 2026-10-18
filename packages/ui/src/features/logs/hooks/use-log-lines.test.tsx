import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderAppHook } from '@ui/__tests__/hook-wrapper.tsx'
import { LOG_PAGE_SIZE } from '@ui/features/logs/constants.ts'
import { useLogLines } from '@ui/features/logs/hooks/use-log-lines.ts'

const EVERYTHING = { minLevel: 'debug' } as const

describe('useLogLines', () => {
  it('loads the newest page first and older pages on demand, never the whole buffer', async () => {
    const { result } = renderAppHook(() => useLogLines(EVERYTHING), {
      scenario: 'logs'
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.entries).toHaveLength(LOG_PAGE_SIZE)
    expect(result.current.hasOlder).toBe(true)
    const newest = result.current.entries.at(-1)?.seq ?? 0
    // 3,000 filler lines (a fifth debug, three fifths info, a fifth warnings) and 3 from startup.
    expect(result.current.counts).toEqual({
      debug: 600,
      info: 1803,
      warn: 600,
      error: 0
    })

    act(() => result.current.loadOlder())
    await waitFor(() =>
      expect(result.current.entries).toHaveLength(2 * LOG_PAGE_SIZE)
    )
    const seqs = result.current.entries.map((entry) => entry.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(seqs.at(-1)).toBe(newest)
  })
})
