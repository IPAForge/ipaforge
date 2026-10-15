// Chunked to avoid the call-stack limit of `String.fromCharCode(...bytes)` on large inputs.
const CHUNK = 0x8000

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[]
    )
  }
  return btoa(binary)
}

/** Accepts standard base64 with optional whitespace/newlines (as found in plists and PEM). */
export const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text.replace(/\s+/g, ''))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
