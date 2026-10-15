/** A readable, random-access file: a file on disk or a download. */
export type FileSource = {
  readonly name: string
  readonly size: number
  stream(): ReadableStream<Uint8Array>
  /** Bytes in `[start, end)`. */
  slice(start: number, end: number): Promise<Uint8Array>
}

/** In-memory FileSource, used by tests and for small downloaded payloads. */
export const bytesFileSource = (
  name: string,
  bytes: Uint8Array
): FileSource => ({
  name,
  size: bytes.byteLength,
  stream: () =>
    new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(bytes)
        controller.close()
      }
    }),
  slice: async (start, end) => bytes.slice(start, end)
})
