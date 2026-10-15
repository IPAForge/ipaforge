import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { createDict, type PlistValue, real } from "@signer/domain/plist/model.ts";

const HEADER = "bplist00";
const TRAILER_SIZE = 32;
/** Seconds between the Unix epoch and the Core Foundation epoch (2001-01-01T00:00:00Z). */
const CF_EPOCH_OFFSET = 978307200;
const MAX_DEPTH = 64;
/**
 * Limits on the EXPANDED result. Objects may be shared (a DAG), so a tiny file can describe an
 * exponentially large tree, or one large string referenced millions of times. Every object is parsed
 * once (memoised) and carries the node and byte totals of its expansion; anything that later walks
 * the result (serializers, rewriters) is bounded by the same totals. Real Info.plists are far smaller.
 */
export const MAX_EXPANDED_NODES = 1_000_000;
export const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;

interface Parsed {
  readonly value: PlistValue;
  /** Nodes in the fully expanded subtree. */
  readonly nodes: number;
  /** String/data bytes in the fully expanded subtree. */
  readonly bytes: number;
  /** Height of the subtree (1 for scalars). Checked on every reuse, so cached subtrees can't deepen the tree. */
  readonly height: number;
}

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

  /** A container's references must lie inside the object area, which also bounds `length`. */
  const assertRefsInBounds = (dataStart: number, count: number, offset: number): void => {
    if (dataStart + count * objectRefSize > offsetTableOffset)
      fail("container exceeds the object area", { offset, count });
  };

  const memo = new Map<number, Parsed>();

  const leaf = (value: PlistValue, size = 8): Parsed => ({ value, nodes: 1, bytes: size, height: 1 });

  const checkBudget = (parsed: Parsed, offset: number): Parsed => {
    if (parsed.nodes > MAX_EXPANDED_NODES || parsed.bytes > MAX_EXPANDED_BYTES) {
      fail("expands beyond the size limits (shared-reference expansion)", {
        offset,
        nodes: parsed.nodes,
        bytes: parsed.bytes,
      });
    }
    return parsed;
  };

  const parseObject = (ref: number, depth: number, stack: Set<number>): Parsed => {
    const cached = memo.get(ref);
    if (cached) {
      // a subtree first parsed near the root must not be re-attached deeper than the limit allows
      if (depth + cached.height - 1 > MAX_DEPTH) fail("nesting too deep", { ref });
      return cached;
    }
    if (depth > MAX_DEPTH) fail("nesting too deep");
    if (stack.has(ref)) fail("reference cycle", { ref });
    const offset = objectOffset(ref);
    const parsed = checkBudget(decode(ref, offset, depth, stack), offset);
    memo.set(ref, parsed);
    return parsed;
  };

  const decode = (ref: number, offset: number, depth: number, stack: Set<number>): Parsed => {
    const marker = bytes[offset] as number;
    const type = marker >> 4;
    const nibble = marker & 0xf;

    switch (type) {
      case 0x0:
        if (marker === 0x08) return leaf(false);
        if (marker === 0x09) return leaf(true);
        return fail("unsupported null/fill object", { offset, marker });
      case 0x1: {
        const size = 1 << nibble;
        if (size > 16) fail("bad integer size", { offset });
        // 1,2,4-byte ints are unsigned; 8- and 16-byte ints are signed two's complement.
        let value = 0n;
        for (let i = 0; i < size; i++) value = (value << 8n) | BigInt(bytes[offset + 1 + i] as number);
        if (size >= 8) value = BigInt.asIntN(size * 8, value);
        const safe = value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER);
        return leaf(safe ? Number(value) : value);
      }
      case 0x2: {
        const size = 1 << nibble;
        if (size === 4) return leaf(real(view.getFloat32(offset + 1, false)));
        if (size === 8) return leaf(real(view.getFloat64(offset + 1, false)));
        return fail("bad real size", { offset });
      }
      case 0x3:
        if (marker !== 0x33) fail("bad date", { offset });
        return leaf(new Date((view.getFloat64(offset + 1, false) + CF_EPOCH_OFFSET) * 1000));
      case 0x4: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length > bytes.byteLength) fail("data past end", { offset });
        return leaf(bytes.slice(dataStart, dataStart + length), length);
      }
      case 0x5: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length > bytes.byteLength) fail("string past end", { offset });
        let text = "";
        for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[dataStart + i] as number);
        return leaf(text, length);
      }
      case 0x6: {
        const { length, dataStart } = readLength(offset, nibble);
        if (dataStart + length * 2 > bytes.byteLength) fail("string past end", { offset });
        let text = "";
        for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint16(dataStart + i * 2, false));
        return leaf(text, length * 2);
      }
      case 0xa:
      case 0xc: {
        const { length, dataStart } = readLength(offset, nibble);
        assertRefsInBounds(dataStart, length, offset);
        const nextStack = new Set(stack).add(ref);
        const items: PlistValue[] = [];
        let nodes = 1;
        let size = 0;
        let height = 1;
        for (let i = 0; i < length; i++) {
          const child = parseObject(readUInt(dataStart + i * objectRefSize, objectRefSize), depth + 1, nextStack);
          items.push(child.value);
          nodes += child.nodes;
          size += child.bytes;
          height = Math.max(height, child.height + 1);
          if (nodes > MAX_EXPANDED_NODES || size > MAX_EXPANDED_BYTES) break; // checkBudget reports it
        }
        return { value: items, nodes, bytes: size, height };
      }
      case 0xd: {
        const { length, dataStart } = readLength(offset, nibble);
        assertRefsInBounds(dataStart, length * 2, offset);
        const nextStack = new Set(stack).add(ref);
        const entries: [string, PlistValue][] = [];
        let nodes = 1;
        let size = 0;
        let height = 1;
        for (let i = 0; i < length; i++) {
          const key = parseObject(readUInt(dataStart + i * objectRefSize, objectRefSize), depth + 1, nextStack);
          if (typeof key.value !== "string") fail("dictionary key is not a string", { offset });
          const valueRef = readUInt(dataStart + (length + i) * objectRefSize, objectRefSize);
          const value = parseObject(valueRef, depth + 1, nextStack);
          entries.push([key.value as string, value.value]);
          nodes += key.nodes + value.nodes;
          size += key.bytes + value.bytes;
          height = Math.max(height, value.height + 1);
          if (nodes > MAX_EXPANDED_NODES || size > MAX_EXPANDED_BYTES) break; // checkBudget reports it
        }
        return { value: createDict(entries), nodes, bytes: size, height };
      }
      default:
        return fail("unsupported object type", { offset, marker });
    }
  };

  return parseObject(topObject, 0, new Set()).value;
};
