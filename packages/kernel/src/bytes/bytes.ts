const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const part of parts) total += part.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
};

export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** Lexicographic byte comparison (like `memcmp`, shorter prefix first). */
export const compareBytes = (a: Uint8Array, b: Uint8Array): number => {
  const length = Math.min(a.byteLength, b.byteLength);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] as number) - (b[i] as number);
    if (diff !== 0) return diff;
  }
  return a.byteLength - b.byteLength;
};

export const utf8Encode = (text: string): Uint8Array => encoder.encode(text);

/** Strict UTF-8 decode; throws on invalid sequences. */
export const utf8Decode = (bytes: Uint8Array): string => decoder.decode(bytes);
