import { encode } from 'uqr'

/** A QR code as one SVG path (a unit square per dark module) and its size in modules, with a 2-module margin. */
export const qrPath = (
  value: string
): { readonly path: string; readonly size: number } => {
  const { data, size } = encode(value, { border: 2 })
  const squares = data.flatMap((row, y) =>
    row.flatMap((isDark, x) => (isDark ? [`M${x} ${y}h1v1h-1z`] : []))
  )

  return { path: squares.join(''), size }
}
