import type { UpdateSource, UpdateState } from '@ipaforge/rpc'

/** An updater that stays where it is: idle in a browser and in tests, or a screen's state for its screenshot. */
export const createFixedUpdateSource = (
  state: UpdateState = { phase: 'idle' }
): UpdateSource & { readonly retries: () => number } => {
  let retries = 0

  return {
    current: () => state,
    subscribe: () => () => {},
    retry: () => {
      retries += 1
    },
    retries: () => retries
  }
}
