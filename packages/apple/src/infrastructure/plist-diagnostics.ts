// Parses a plist from Apple, and when it is not one, says which step failed and what the document starts with:
// only the first tag name and the byte length, never content (these documents carry tokens).
import { ErrorCode, LoadstarError, type PlistValue, parsePlist, utf8Decode } from "@loadstar/kernel";

const firstMarkup = (bytes: Uint8Array): string => {
  if (bytes.byteLength >= 8 && utf8Decode(bytes.subarray(0, 6)) === "bplist") return "binary plist";
  const head = utf8Decode(bytes.subarray(0, 256));
  const tag = /^\s*<([!?]?[A-Za-z][\w:-]*)/.exec(head)?.[1];
  return tag ? `<${tag}>` : bytes.byteLength === 0 ? "empty" : "not markup";
};

export const parseApplePlist = (bytes: Uint8Array, step: string): PlistValue => {
  try {
    return parsePlist(bytes);
  } catch (error) {
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: `${step}: Apple's response is not a readable plist`,
      cause: error,
      data: { step, startsWith: firstMarkup(bytes), bytes: bytes.byteLength },
    });
  }
};
