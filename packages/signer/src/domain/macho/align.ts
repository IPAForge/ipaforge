/** Rounds `value` up to the next multiple of `alignment`. */
export const alignUp = (value: number, alignment: number): number =>
  Math.ceil(value / alignment) * alignment

/** `alignUp` for 64-bit Mach-O fields. */
export const alignUpBig = (value: bigint, alignment: bigint): bigint =>
  ((value + alignment - 1n) / alignment) * alignment
