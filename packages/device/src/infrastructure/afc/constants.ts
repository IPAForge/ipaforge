// AFC (Apple File Conduit) wire constants. Packets are little-endian.

/** "CFA6LPAA" */
export const AFC_MAGIC = new Uint8Array([0x43, 0x46, 0x41, 0x36, 0x4c, 0x50, 0x41, 0x41]);
/** magic(8) + entire length(8) + this length(8) + packet number(8) + operation(8). */
export const AFC_HEADER_SIZE = 40;

export const AfcOperation = {
  Status: 0x01,
  Data: 0x02,
  ReadDir: 0x03,
  RemovePath: 0x08,
  MakeDir: 0x09,
  GetFileInfo: 0x0a,
  GetDeviceInfo: 0x0b,
  FileOpen: 0x0d,
  FileOpenResult: 0x0e,
  FileRead: 0x0f,
  FileWrite: 0x10,
  FileClose: 0x14,
  RenamePath: 0x18,
  RemovePathAndContents: 0x22,
} as const;

export const AfcFileMode = {
  ReadOnly: 1n,
  ReadWrite: 2n,
  /** Write-only, create, truncate. */
  WriteOnly: 3n,
} as const;

/** AFC status codes (0 = success). */
export const AFC_STATUS_NAMES: Readonly<Record<number, string>> = {
  1: "UnknownError",
  2: "OpHeaderInvalid",
  3: "NoResources",
  4: "ReadError",
  5: "WriteError",
  6: "UnknownPacketType",
  7: "InvalidArg",
  8: "ObjectNotFound",
  9: "ObjectIsDir",
  10: "PermDenied",
  11: "ServiceNotConnected",
  12: "OpTimeout",
  13: "TooMuchData",
  14: "EndOfData",
  15: "OpNotSupported",
  16: "ObjectExists",
  17: "ObjectBusy",
  18: "NoSpaceLeft",
  19: "OpWouldBlock",
  20: "IoError",
  21: "OpInterrupted",
  22: "OpInProgress",
  23: "InternalError",
  30: "MuxError",
  31: "NoMem",
  32: "NotEnoughData",
  33: "DirNotEmpty",
};

export const AFC_STATUS_OBJECT_NOT_FOUND = 8;
export const AFC_STATUS_OBJECT_EXISTS = 16;
