import { ByteReader, ByteWriter, ErrorCode, LoadstarError } from "@loadstar/kernel";
import { CSMAGIC_BLOBWRAPPER, CSMAGIC_EMBEDDED_SIGNATURE } from "@signer/domain/blobs/constants.ts";

export interface BlobEntry {
  readonly slot: number;
  readonly blob: Uint8Array;
}

/** `magic | length | payload` — the generic code-signing blob envelope. */
export const wrapBlob = (magic: number, payload: Uint8Array): Uint8Array =>
  new ByteWriter(payload.byteLength + 8)
    .u32be(magic)
    .u32be(payload.byteLength + 8)
    .bytes(payload)
    .toBytes();

/** BlobWrapper for the CMS signature (empty for ad-hoc signatures). */
export const blobWrapper = (cms: Uint8Array = new Uint8Array(0)): Uint8Array => wrapBlob(CSMAGIC_BLOBWRAPPER, cms);

/** Embedded-signature SuperBlob; entries are ordered by slot number (Apple keys them in a std::map). */
export const buildSuperBlob = (entries: readonly BlobEntry[]): Uint8Array => {
  const sorted = [...entries].sort((a, b) => a.slot - b.slot);
  const headerSize = 12 + 8 * sorted.length;
  const total = headerSize + sorted.reduce((sum, entry) => sum + entry.blob.byteLength, 0);

  const writer = new ByteWriter(total).u32be(CSMAGIC_EMBEDDED_SIGNATURE).u32be(total).u32be(sorted.length);
  let offset = headerSize;
  for (const entry of sorted) {
    writer.u32be(entry.slot).u32be(offset);
    offset += entry.blob.byteLength;
  }
  for (const entry of sorted) writer.bytes(entry.blob);
  return writer.toBytes();
};

/** Reads the blobs of an embedded signature (views into `bytes`). */
export const parseSuperBlob = (bytes: Uint8Array): BlobEntry[] => {
  const reader = new ByteReader(bytes);
  if (reader.u32be() !== CSMAGIC_EMBEDDED_SIGNATURE) {
    throw new LoadstarError(ErrorCode.InvalidMachO, { message: "not an embedded signature SuperBlob" });
  }
  const length = reader.u32be();
  const count = reader.u32be();
  if (length > bytes.byteLength || 12 + 8 * count > length) {
    throw new LoadstarError(ErrorCode.InvalidMachO, { message: "SuperBlob header out of range" });
  }
  return Array.from({ length: count }, () => {
    const slot = reader.u32be();
    const offset = reader.u32be();
    const blobLength = new ByteReader(bytes, offset + 4).u32be();
    if (offset + blobLength > length) {
      throw new LoadstarError(ErrorCode.InvalidMachO, { message: "SuperBlob entry out of range", data: { slot } });
    }
    return { slot, blob: bytes.subarray(offset, offset + blobLength) };
  });
};

export const findBlob = (entries: readonly BlobEntry[], slot: number): Uint8Array | undefined =>
  entries.find((entry) => entry.slot === slot)?.blob;
