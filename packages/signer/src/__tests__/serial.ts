// Test-only: certificate serial numbers for generated test certificates.

/** A random serial in 1…2^31, from the platform CSPRNG. */
export const randomSerialNumber = (): number => {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1))

  // Drop one bit: 31 random bits, then shift away from 0 (serials are positive).
  return (value >>> 1) + 1
}
