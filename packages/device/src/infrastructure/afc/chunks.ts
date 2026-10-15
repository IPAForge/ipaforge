/** Calls `onChunk` for each piece of `content`, at most `chunkBytes` long, in order. */
export const forEachChunk = async (
  content: Uint8Array | ReadableStream<Uint8Array>,
  chunkBytes: number,
  onChunk: (chunk: Uint8Array) => Promise<void>,
): Promise<void> => {
  const split = async (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.byteLength; i += chunkBytes) await onChunk(bytes.subarray(i, i + chunkBytes));
  };
  if (content instanceof Uint8Array) {
    await split(content);
    return;
  }
  const reader = content.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      await split(value);
    }
  } finally {
    reader.releaseLock();
  }
};
