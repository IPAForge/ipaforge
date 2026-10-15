import { AFC_HEADER_SIZE, AFC_MAGIC } from "@device/infrastructure/afc/constants.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { ByteWriter, concatBytes, ErrorCode, equalBytes, LoadstarError, utf8Decode } from "@loadstar/kernel";

export interface AfcPacket {
  readonly operation: number;
  readonly packetNumber: bigint;
  /** Operation arguments (between the header and `this length`). */
  readonly header: Uint8Array;
  /** Bulk data (after `this length`). */
  readonly data: Uint8Array;
}

export const encodeAfcPacket = (packet: AfcPacket): Uint8Array => {
  const thisLength = AFC_HEADER_SIZE + packet.header.byteLength;
  const entireLength = thisLength + packet.data.byteLength;
  return new ByteWriter(entireLength)
    .bytes(AFC_MAGIC)
    .u64le(BigInt(entireLength))
    .u64le(BigInt(thisLength))
    .u64le(packet.packetNumber)
    .u64le(BigInt(packet.operation))
    .bytes(packet.header)
    .bytes(packet.data)
    .toBytes();
};

export const readAfcPacket = async (link: Link, maxBytes: number): Promise<AfcPacket> => {
  const fixed = await link.reader.readExact(AFC_HEADER_SIZE);
  if (!equalBytes(fixed.subarray(0, AFC_MAGIC.byteLength), AFC_MAGIC)) {
    throw new LoadstarError(ErrorCode.AfcError, { message: "bad AFC magic" });
  }
  const view = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  const entireLength = view.getBigUint64(8, true);
  const thisLength = view.getBigUint64(16, true);
  const packetNumber = view.getBigUint64(24, true);
  const operation = Number(view.getBigUint64(32, true));
  if (thisLength < AFC_HEADER_SIZE || entireLength < thisLength || entireLength > BigInt(maxBytes)) {
    throw new LoadstarError(ErrorCode.AfcError, {
      message: `invalid AFC lengths (entire ${entireLength}, this ${thisLength})`,
    });
  }
  const header = await link.reader.readExact(Number(thisLength) - AFC_HEADER_SIZE);
  const data = await link.reader.readExact(Number(entireLength - thisLength));
  return { operation, packetNumber, header, data };
};

/** Devices put response payloads in either part; callers read them as one. */
export const payloadOf = (packet: AfcPacket): Uint8Array =>
  packet.header.byteLength === 0 ? packet.data : concatBytes([packet.header, packet.data]);

/** NUL-terminated strings (directory listings, key/value file info). Empty values are kept so pairs stay aligned. */
export const splitCStrings = (bytes: Uint8Array): string[] => {
  const parts = utf8Decode(bytes).split("\0");
  if (parts.at(-1) === "") parts.pop();
  return parts;
};
