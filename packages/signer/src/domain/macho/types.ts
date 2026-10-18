import type { ByteReader } from '@ipaforge/kernel'

export type Segment = {
  readonly name: string
  /** Offset of the LC_SEGMENT(_64) command within the slice. */
  readonly commandOffset: number
  readonly vmaddr: bigint
  readonly vmsize: bigint
  readonly fileoff: bigint
  readonly filesize: bigint
  readonly nsects: number
  readonly flags: number
}

export type CodeSignatureCommand = {
  readonly commandOffset: number
  readonly dataoff: number
  readonly datasize: number
}

export type BuildVersion = {
  /** A `Platform` identifier; binaries may carry ones this table doesn't name. */
  readonly platform: number
  /** Packed `xxxx.yy.zz` (see `packVersion`). */
  readonly minOS: number
}

export type Slice = {
  /** Offset of this slice within the file (0 for thin files). */
  readonly fileOffset: number
  /** The slice's bytes (a view into the file). */
  readonly bytes: Uint8Array
  readonly is64: boolean
  readonly headerSize: number
  readonly cputype: number
  readonly cpusubtype: number
  readonly filetype: number
  readonly ncmds: number
  readonly sizeofcmds: number
  readonly segments: readonly Segment[]
  readonly codeSignature: CodeSignatureCommand | undefined
  readonly buildVersion: BuildVersion | undefined
  readonly uuid: Uint8Array | undefined
  /** `cryptid` of LC_ENCRYPTION_INFO(_64); non-zero means FairPlay-encrypted. */
  readonly cryptid: number
  /** Lowest file offset of any non-empty, non-zerofill section: load commands may grow up to here. */
  readonly firstSectionOffset: number
}

export type FatArch = {
  readonly cputype: number
  readonly cpusubtype: number
  readonly offset: number
  readonly size: number
  /** Power-of-two alignment exponent (normally 14). */
  readonly align: number
}

export type MachOFile = {
  /** Present for universal binaries; `slices[i]` corresponds to `fat[i]`. */
  readonly fat: readonly FatArch[] | undefined
  readonly slices: readonly Slice[]
}

export type CodeDirectoryEstimate = {
  readonly identifierLength: number // UTF-8 bytes, without NUL
  readonly teamIdLength: number // 0 when there is no team
  readonly pageSize: number
  readonly hashSize: number
  readonly nSpecialSlots: number
}

export type SignatureEstimate = {
  /** The non-CD blobs actually emitted: requirement set, XML and DER entitlements. */
  readonly pieces: readonly Uint8Array[]
  readonly codeDirectories: readonly CodeDirectoryEstimate[]
  /** Bytes reserved for the CMS blob (codesign uses 18000; see SigningPolicy.cmsReservation). */
  readonly cmsReservation: number
}

export type PreparedImage = {
  /** Final slice bytes: patched header + code + zero padding, sized `dataoff + datasize`. */
  readonly image: Uint8Array
  /** Where the SuperBlob goes; everything before it is hashed by the CodeDirectory. */
  readonly codeLimit: number
  readonly datasize: number
  readonly addedLoadCommand: boolean
}

export type MachHeader = {
  readonly is64: boolean
  readonly headerSize: number
  readonly cputype: number
  readonly cpusubtype: number
  readonly filetype: number
  readonly ncmds: number
  readonly sizeofcmds: number
}

/** What the signer needs from the load commands, filled in as they are read. */
export type LoadCommandScan = {
  readonly segments: Segment[]
  codeSignature: CodeSignatureCommand | undefined
  buildVersion: BuildVersion | undefined
  uuid: Uint8Array | undefined
  cryptid: number
  firstSectionOffset: number
}

/** Where a load command sits and what it is. */
export type LoadCommand = {
  readonly offset: number
  readonly cmd: number
  readonly cmdsize: number
}

/** Records one load command; `command` is positioned just after its `cmd`/`cmdsize` fields. */
export type LoadCommandReader = (
  scan: LoadCommandScan,
  bytes: Uint8Array,
  load: LoadCommand,
  command: ByteReader
) => void
