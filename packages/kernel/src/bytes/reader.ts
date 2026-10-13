import { ErrorCode } from "@kernel/errors/codes.ts";
import { LoadstarError } from "@kernel/errors/loadstar-error.ts";

/**
 * Bounds-checked sequential reader. Every multi-byte read names its endianness explicitly:
 * Mach-O headers are little-endian, code-signature blobs and plists are big-endian.
 */
export class ByteReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  #position: number;

  constructor(bytes: Uint8Array, position = 0) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.#position = position;
  }

  get position(): number {
    return this.#position;
  }

  get length(): number {
    return this.#bytes.byteLength;
  }

  get remaining(): number {
    return this.#bytes.byteLength - this.#position;
  }

  seek(position: number): this {
    if (position < 0 || position > this.#bytes.byteLength) this.#outOfRange(position, 0);
    this.#position = position;
    return this;
  }

  skip(count: number): this {
    return this.seek(this.#position + count);
  }

  align(boundary: number): this {
    const rem = this.#position % boundary;
    return rem === 0 ? this : this.skip(boundary - rem);
  }

  u8(): number {
    return this.#view.getUint8(this.#take(1));
  }

  u16le(): number {
    return this.#view.getUint16(this.#take(2), true);
  }

  u16be(): number {
    return this.#view.getUint16(this.#take(2), false);
  }

  u32le(): number {
    return this.#view.getUint32(this.#take(4), true);
  }

  u32be(): number {
    return this.#view.getUint32(this.#take(4), false);
  }

  i32le(): number {
    return this.#view.getInt32(this.#take(4), true);
  }

  i32be(): number {
    return this.#view.getInt32(this.#take(4), false);
  }

  u64le(): bigint {
    return this.#view.getBigUint64(this.#take(8), true);
  }

  u64be(): bigint {
    return this.#view.getBigUint64(this.#take(8), false);
  }

  /** A view (not a copy) of the next `count` bytes. */
  bytes(count: number): Uint8Array {
    const start = this.#take(count);
    return this.#bytes.subarray(start, start + count);
  }

  /** NUL-terminated string; consumes the terminator. `maxLength` bounds fixed-width fields. */
  cstring(maxLength = this.remaining): string {
    const start = this.#position;
    const window = this.#bytes.subarray(start, start + Math.min(maxLength, this.remaining));
    const end = window.indexOf(0);
    const text = new TextDecoder().decode(end < 0 ? window : window.subarray(0, end));
    this.#position = start + (end < 0 ? window.byteLength : end + 1);
    return text;
  }

  #take(count: number): number {
    const start = this.#position;
    if (count < 0 || start + count > this.#bytes.byteLength) this.#outOfRange(start, count);
    this.#position = start + count;
    return start;
  }

  #outOfRange(offset: number, length: number): never {
    throw new LoadstarError(ErrorCode.Unexpected, {
      message: "read out of range",
      data: { offset, length, size: this.#bytes.byteLength },
    });
  }
}
