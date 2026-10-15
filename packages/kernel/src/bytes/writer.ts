import { utf8Encode } from '@kernel/bytes/bytes.ts'

const DEFAULT_CAPACITY = 256
const MIN_CAPACITY = 16

/** Growable byte builder with explicit endianness per write. */
export class ByteWriter {
  #buffer: Uint8Array
  #view: DataView
  #length = 0

  constructor(initialCapacity = DEFAULT_CAPACITY) {
    this.#buffer = new Uint8Array(Math.max(MIN_CAPACITY, initialCapacity))
    this.#view = new DataView(this.#buffer.buffer)
  }

  get length(): number {
    return this.#length
  }

  u8(value: number): this {
    const at = this.#grow(1)
    this.#view.setUint8(at, value)
    return this
  }

  u16le(value: number): this {
    const at = this.#grow(2)
    this.#view.setUint16(at, value, true)
    return this
  }

  u16be(value: number): this {
    const at = this.#grow(2)
    this.#view.setUint16(at, value, false)
    return this
  }

  u32le(value: number): this {
    const at = this.#grow(4)
    this.#view.setUint32(at, value >>> 0, true)
    return this
  }

  u32be(value: number): this {
    const at = this.#grow(4)
    this.#view.setUint32(at, value >>> 0, false)
    return this
  }

  u64le(value: bigint): this {
    const at = this.#grow(8)
    this.#view.setBigUint64(at, value, true)
    return this
  }

  u64be(value: bigint): this {
    const at = this.#grow(8)
    this.#view.setBigUint64(at, value, false)
    return this
  }

  bytes(value: Uint8Array): this {
    const at = this.#grow(value.byteLength)
    this.#buffer.set(value, at)
    return this
  }

  /** Writes UTF-8 text followed by a NUL terminator. */
  cstring(value: string): this {
    return this.bytes(utf8Encode(value)).u8(0)
  }

  /** Pads with `fill` up to the next multiple of `boundary`. */
  align(boundary: number, fill = 0): this {
    while (this.#length % boundary !== 0) this.u8(fill)
    return this
  }

  /** Overwrites a big-endian u32 at an earlier offset (e.g. a length field written last). */
  patchU32be(offset: number, value: number): this {
    if (offset < 0 || offset + 4 > this.#length)
      throw new RangeError(`patch offset ${offset} out of range`)
    this.#view.setUint32(offset, value >>> 0, false)
    return this
  }

  /** A copy of the written bytes. */
  toBytes(): Uint8Array {
    return this.#buffer.slice(0, this.#length)
  }

  // Callers must call #grow before touching #buffer/#view: growing replaces both.
  #grow(count: number): number {
    const start = this.#length
    const needed = start + count
    this.#ensureCapacity(needed)
    this.#length = needed
    return start
  }

  /** Doubles the buffer until `needed` bytes fit, keeping what was written. */
  #ensureCapacity(needed: number): void {
    if (needed <= this.#buffer.byteLength) return
    let capacity = this.#buffer.byteLength * 2
    while (capacity < needed) capacity *= 2
    const next = new Uint8Array(capacity)
    next.set(this.#buffer.subarray(0, this.#length))
    this.#buffer = next
    this.#view = new DataView(next.buffer)
  }
}
