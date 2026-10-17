/**
 * Mach-O packed versions: `xxxx.yy.zz` as `(major << 16) | (minor << 8) | patch`.
 * Used for minOS decisions (hash algorithm, page size).
 */

export const packVersion = (major: number, minor = 0, patch = 0): number =>
  ((major & 0xffff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff)

export const formatVersion = (version: number): string => {
  const major = version >>> 16
  const minor = (version >>> 8) & 0xff
  const patch = version & 0xff

  return patch ? `${major}.${minor}.${patch}` : `${major}.${minor}`
}

/** Parses "14", "14.0", "14.0.1" (as found in Info.plist MinimumOSVersion). */
export const parseVersion = (text: string): number => {
  const [major = 0, minor = 0, patch = 0] = text
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)

  return packVersion(major, minor, patch)
}

/** Numeric, dotted comparison ("26.1" ≥ "15.0", "9.3.5" < "10"); missing parts count as 0. */
export const isVersionAtLeast = (version: string, minimum: string): boolean =>
  parseVersion(version) >= parseVersion(minimum)
