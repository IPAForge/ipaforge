// Time limits for every test project. The Windows CI runners are several times slower than a developer machine,
// and a limit that only a busy runner reaches makes a test fail for no reason, so they leave plenty of room:
// 10 s per test and hook, 5 s for `expect.poll` and (through test-setup.ts) `vi.waitFor`. A test that hangs still
// fails, just later.
import { fileURLToPath } from 'node:url'

export const testDefaults = {
  testTimeout: 10_000,
  hookTimeout: 10_000,
  expect: { poll: { timeout: 5000 } },
  setupFiles: [fileURLToPath(new URL('test-setup.ts', import.meta.url))]
}
