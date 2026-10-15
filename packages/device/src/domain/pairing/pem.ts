import { ErrorCode, fromBase64, LoadstarError, toBase64, utf8Decode, utf8Encode } from "@loadstar/kernel";

const PEM_BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;
const PEM_LINE_WIDTH = 64;

export interface PemBlock {
  readonly label: string;
  readonly der: Uint8Array;
}

/** Decodes the first PEM block in `pem` (string or bytes, as pair records store it). */
export const decodePem = (pem: string | Uint8Array): PemBlock => {
  const text = typeof pem === "string" ? pem : utf8Decode(pem);
  const match = PEM_BLOCK.exec(text);
  if (!match?.[1] || match[2] === undefined) {
    throw new LoadstarError(ErrorCode.InvalidPairRecord, { message: "expected a PEM block" });
  }
  return { label: match[1], der: fromBase64(match[2].replace(/\s+/g, "")) };
};

export const encodePem = (label: string, der: Uint8Array): string => {
  const base64 = toBase64(der);
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += PEM_LINE_WIDTH) lines.push(base64.slice(i, i + PEM_LINE_WIDTH));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
};

export const pemBytes = (label: string, der: Uint8Array): Uint8Array => utf8Encode(encodePem(label, der));

export const pemText = (pem: string | Uint8Array): string => (typeof pem === "string" ? pem : utf8Decode(pem));
