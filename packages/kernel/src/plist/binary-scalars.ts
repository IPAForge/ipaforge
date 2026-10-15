// Decoders for the binary plist object types that hold no references.

import { failBinaryPlist as fail } from "@kernel/plist/binary-error.ts";
import { leaf, type Parsed } from "@kernel/plist/binary-expansion.ts";
import {
  CF_EPOCH_OFFSET,
  MAX_INTEGER_SIZE,
  Marker,
  MIN_SIGNED_INTEGER_SIZE,
  SCALAR_SIZE,
} from "@kernel/plist/binary-format.ts";
import type { BinaryPlistReader } from "@kernel/plist/binary-reader.ts";
import { type PlistValue, real } from "@kernel/plist/model.ts";

const MS_PER_SECOND = 1000;
const UTF16_UNIT_SIZE = 2;
const FLOAT32_SIZE = 4;
const FLOAT64_SIZE = 8;

const scalar = (value: PlistValue): Parsed => leaf(value, SCALAR_SIZE);

const toSafeNumber = (value: bigint): number | bigint =>
  value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;

export const decodeSimple = (marker: number, offset: number): Parsed => {
  if (marker === Marker.False) return scalar(false);
  if (marker === Marker.True) return scalar(true);
  return fail("unsupported null/fill object", { offset, marker });
};

export const decodeInteger = ({ bytes }: BinaryPlistReader, offset: number, nibble: number): Parsed => {
  const size = 1 << nibble;
  if (size > MAX_INTEGER_SIZE) fail("bad integer size", { offset });
  let value = 0n;
  for (let i = 0; i < size; i++) value = (value << 8n) | BigInt(bytes[offset + 1 + i] as number);
  if (size >= MIN_SIGNED_INTEGER_SIZE) value = BigInt.asIntN(size * 8, value);
  return scalar(toSafeNumber(value));
};

export const decodeReal = ({ view }: BinaryPlistReader, offset: number, nibble: number): Parsed => {
  const size = 1 << nibble;
  if (size === FLOAT32_SIZE) return scalar(real(view.getFloat32(offset + 1, false)));
  if (size === FLOAT64_SIZE) return scalar(real(view.getFloat64(offset + 1, false)));
  return fail("bad real size", { offset });
};

export const decodeDate = ({ view }: BinaryPlistReader, offset: number, marker: number): Parsed => {
  if (marker !== Marker.Date) fail("bad date", { offset });
  const seconds = view.getFloat64(offset + 1, false) + CF_EPOCH_OFFSET;
  return scalar(new Date(seconds * MS_PER_SECOND));
};

export const decodeData = (reader: BinaryPlistReader, offset: number, nibble: number): Parsed => {
  const { length, dataStart } = reader.readLength(offset, nibble);
  if (dataStart + length > reader.bytes.byteLength) fail("data past end", { offset });
  return leaf(reader.bytes.slice(dataStart, dataStart + length), length);
};

export const decodeAsciiString = (reader: BinaryPlistReader, offset: number, nibble: number): Parsed => {
  const { length, dataStart } = reader.readLength(offset, nibble);
  if (dataStart + length > reader.bytes.byteLength) fail("string past end", { offset });
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(reader.bytes[dataStart + i] as number);
  return leaf(text, length);
};

export const decodeUtf16String = (reader: BinaryPlistReader, offset: number, nibble: number): Parsed => {
  const { length, dataStart } = reader.readLength(offset, nibble);
  const size = length * UTF16_UNIT_SIZE;
  if (dataStart + size > reader.bytes.byteLength) fail("string past end", { offset });
  let text = "";
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(reader.view.getUint16(dataStart + i * UTF16_UNIT_SIZE, false));
  }
  return leaf(text, size);
};
