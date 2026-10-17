export const pageCount = (length: number, pageSize: number): number =>
  Math.ceil(length / pageSize)

export const pageAt = (
  data: Uint8Array,
  index: number,
  pageSize: number
): Uint8Array =>
  data.subarray(
    index * pageSize,
    Math.min((index + 1) * pageSize, data.byteLength)
  )
