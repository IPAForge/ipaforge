const WILDCARD = '*'

/**
 * Whether a release asset's name fits the catalog's: exact, or with one `*` standing for any text, for releases
 * whose file name carries the version (`StikDebug-*.ipa` fits `StikDebug-3.1.15.ipa`). No regular expressions:
 * the pattern comes from a manifest fetched over the network.
 */
export const matchesAssetName = (name: string, pattern: string): boolean => {
  const star = pattern.indexOf(WILDCARD)
  if (star === -1) return name === pattern
  const prefix = pattern.slice(0, star)
  const suffix = pattern.slice(star + 1)

  return (
    name.length >= prefix.length + suffix.length &&
    name.startsWith(prefix) &&
    name.endsWith(suffix)
  )
}
