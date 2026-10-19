const parts = (version: string): number[] =>
  version.split(/\D+/).filter(Boolean).map(Number)

/**
 * Whether `candidate` is a newer version than `current`, comparing their numbers in order (`2.10.0` > `2.9.1`,
 * `2.1.3-nightly.20261019` > `2.1.2`). Versions without numbers are never newer.
 */
export const isNewerVersion = (candidate: string, current: string): boolean => {
  const next = parts(candidate)
  const now = parts(current)
  const length = Math.max(next.length, now.length)

  for (let index = 0; index < length; index++) {
    const a = next[index] ?? 0
    const b = now[index] ?? 0

    if (a !== b) return a > b
  }

  return false
}
