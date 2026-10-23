// Runs before every test file: `vi.waitFor` waits up to 5 s instead of 1 s unless a test says otherwise, like
// `expect.poll` (test-defaults.ts), so a slow CI runner doesn't fail a test that only needed more time.
import { vi } from 'vitest'

const WAIT_FOR_TIMEOUT_MS = 5000
const waitFor = vi.waitFor.bind(vi)

vi.waitFor = ((callback, options) =>
  waitFor(
    callback,
    typeof options === 'number'
      ? options
      : { timeout: WAIT_FOR_TIMEOUT_MS, ...options }
  )) as typeof vi.waitFor
