import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { createDict, type PlistValue, real } from "@signer/domain/plist/model.ts";

const HEADER = "bplist00";
const TRAILER_SIZE = 32;
/** Seconds between the Unix epoch and the Core Foundation epoch (2001-01-01T00:00:00Z). */
const CF_EPOCH_OFFSET = 978307200;
const MAX_DEPTH = 64;

const fail = (message: string, data?: Record<string, unknown>): never => {
  throw new LoadstarError(ErrorCode.InvalidPlist, { message: `binary plist: ${message}`, ...(data ? { data } : {}) });
};

export const isBinaryPlist = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= 8 && String.fromCharCode(...bytes.subarray(0, 8)) === HEADER;

/** Parses a `bplist00` property list (the format of most Info.plist files inside IPAs). */
export const parseBinaryPlist = (bytes: Uint8Array): PlistValue => {
  if (!isBinaryPlist(bytes) || bytes.byteLength < 8 + TRAILER_SIZE) fail("not a bplist00 file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const trailer = bytes.byteLength - TRAILER_SIZE;
  const offsetIntSize = view.getUint8(trailer + 6);
  const objectRefSize = view.getUint8(trailer + 7);
  const numObjects = Number(view.getBigUint64(trailer + 8, false));
  const topObject = Number(view.getBigUint64(trailer + 16, false));
  const offsetTableOffset = Number(view.getBigUint64(trailer + 24, false));

  if (![1, 2, 4, 8].includes(offsetIntSize) || ![1, 2, 4, 8].includes(objectRefSize)) fail("bad trailer sizes");
  if (offsetTableOffset + numObjects * offsetIntSize > trailer || topObject >= numObjects) fail("bad offset table");

  const readUInt = (offset: number, size: number): number => {
    if (offset + size > bytes.byteLength) fail("read past end", { offset, size });
    let value = 0;
    for (let i = 0; i < size; i++) value = value * 256 + (bytes[offset + i] as number);
    if (!Number.isSafeInteger(value)) fail("integer too large", { offset });
    return value;
  };

  const objectOffset = (ref: number): number => {
    if (ref >= numObjects) fail("object reference out of range", { ref });
    const offset = readUInt(offsetTableOffset + ref * offsetIntSize, offsetIntSize);
    if (offset < 8 || offset >= offsetTableOffset) fail("object offset out of range", { ref, offset });
    return offset;
  };

  /** Length of an object: low nibble, or a following int object when the nibble is 0xF. */
  const readLength = (offset: number, nibble: number): { length: number; dataStart: number } => {
    if (nibble !== 0xf) return { length: nibble, dataStart: offset + 1 };
    const marker = bytes[offset + 1] as number;
    if (marker >> 4 !== 0x1) fail("bad extended length", { offset });
    const size = 1 << (marker & 0xf);
    return { length: readUInt(offset + 2, size), dataStart: offset + 2 + size };
  };

  const parseObject = (ref: number, depth: number, stack: Set<number>): PlistValue => {
    if (depth > MAX_DEPTH) fail("nesting too deep");
    if (stack.has(ref)) fail("reference cycle", { ref });
    const offset = objectOffset(ref);
    const marker = bytes[offset] as number;
    const type = marker >> 4;
    const nibble = marker & 0xf;

    switch (type) {
      case 0x0:
        if (marker === 0x08) return false;
        if (marker === 0x09) return true;
        return fail("unsupported null/fill object", { offset, marker });
      case 0x1: {
        const size = 1 << nibble;
        if (size > 16) fail("bad integer size", { offset });
        // 1,2,4-byte ints are unsigned; 8- and 16-byte ints are signed two's complement.
        let value = 0n;
        for (let i = 0; i < size; i++) value = (value << 8n) | BigInt(bytes[offset + 1 + i] as number);
        if (size >= 8) value = BigInt.asIntN(size * 8, value);
        return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(value)
          : value;
      }
      case 0x2: {
        const size = 1 << nibble;
        if (size === 4) return real(view.getFloat32(offset + 1, false));
        if (size === 8) return real(view.getFloat64(offset + 1, false));
        return fail("bad real size", { offset });
      }
      case 0x3:
        if (marker !== 0x33) fail("bad date", { offset });
        return new Date((view.getFloat64(offset + 1, false) + CF_EPOCH_OFFSET) * 1000);
      case 0x4: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length > bytes.byteLength) fail("data past end", { offset });
        return bytes.slice(dataStart, dataStart + length);
      }
      case 0x5: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length > bytes.byteLength) fail("string past end", { offset });
        let text = "";
        for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[dataStart + i] as number);
        return text;
      }
      case 0x6: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length * 2 > bytes.byteLength) fail("string past end", { offset });
        let text = "";
        for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint16(dataStart + i * 2, false));
        return text;
      }
      case 0xa:
      case 0xc: {
        const { length, dataStart } = readLength(offset, nibble);
        const nextStack = new Set(stack).add(ref);
        return Array.from({ length }, (_, i) =>
          parseObject(readUInt(dataStart + i * objectRefSize, objectRefSize), depth + 1, nextStack),
        );
      }
      case 0xd: {
        const { length, dataStart } = readLength(offset, nibble);
        const nextStack = new Set(stack).add(ref);
        const entries: [string, PlistValue][] = [];
        for (let i = 0; i < length; i++) {
          const key = parseObject(readUInt(dataStart + i * objectRefSize, objectRefSize), depth + 1, nextStack);
          if (typeof key !== "string") fail("dictionary key is not a string", { offset });
          const valueRef = readUInt(dataStart + (length + i) * objectRefSize, objectRefSize);
          entries.push([key as string, parseObject(valueRef, depth + 1, nextStack)]);
        }
        return createDict(entries);
      }
      default:
        return fail("unsupported object type", { offset, marker });
    }
  };

  return parseObject(topObject, 0, new Set());
};
