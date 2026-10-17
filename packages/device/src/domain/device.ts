/** Shortens a UDID for logs and UI (`…1a2b`). */
export const shortUdid = (udid: string): string => `…${udid.slice(-4)}`

/** Parses "17.4.1" → [17, 4, 1]; missing parts are 0. */
export const parseVersion = (
  version: string
): readonly [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)

  return [major, minor, patch]
}
