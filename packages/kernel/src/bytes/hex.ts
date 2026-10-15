const HEX = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
)

export const toHex = (bytes: Uint8Array): string => {
  let out = ''
  for (const byte of bytes) out += HEX[byte]
  return out
}

export const fromHex = (hex: string): Uint8Array => {
  const clean = hex.replace(/\s+/g, '')
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean))
    throw new SyntaxError('invalid hex string')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}
