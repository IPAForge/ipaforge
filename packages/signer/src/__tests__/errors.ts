// Test-only: what a call failed with, for the test body to assert on.

import { IPAForgeError } from '@ipaforge/kernel'

/** The code of the IPAForgeError `run` throws; `undefined` when it returns. Other errors propagate. */
export const thrownCode = (run: () => unknown): string | undefined => {
  try {
    run()
  } catch (error) {
    if (error instanceof IPAForgeError) return error.code
    throw error
  }
  return undefined
}

/** The IPAForgeError `run` rejects or throws with; `undefined` when it succeeds. Other errors propagate. */
export const rejection = async (
  run: Promise<unknown> | (() => unknown)
): Promise<IPAForgeError | undefined> => {
  try {
    await (typeof run === 'function' ? run() : run)
  } catch (error) {
    if (error instanceof IPAForgeError) return error
    throw error
  }
  return undefined
}
