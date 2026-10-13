import type { Platform } from "@signer/domain/macho/constants.ts";
import type { PackedVersion } from "@signer/domain/macho/version.ts";

export interface Segment {
  readonly name: string;
  /** Offset of the LC_SEGMENT(_64) command within the slice. */
  readonly commandOffset: number;
  readonly vmaddr: bigint;
  readonly vmsize: bigint;
  readonly fileoff: bigint;
  readonly filesize: bigint;
  readonly nsects: number;
  readonly flags: number;
}

export interface CodeSignatureCommand {
  readonly commandOffset: number;
  readonly dataoff: number;
  readonly datasize: number;
}

export interface BuildVersion {
  readonly platform: Platform;
  readonly minOS: PackedVersion;
}

export interface Slice {
  /** Offset of this slice within the file (0 for thin files). */
  readonly fileOffset: number;
  /** The slice's bytes (a view into the file). */
  readonly bytes: Uint8Array;
  readonly is64: boolean;
  readonly headerSize: number;
  readonly cputype: number;
  readonly cpusubtype: number;
  readonly filetype: number;
  readonly ncmds: number;
  readonly sizeofcmds: number;
  readonly segments: readonly Segment[];
  readonly codeSignature: CodeSignatureCommand | undefined;
  readonly buildVersion: BuildVersion | undefined;
  readonly uuid: Uint8Array | undefined;
  /** `cryptid` of LC_ENCRYPTION_INFO(_64); non-zero means FairPlay-encrypted. */
  readonly cryptid: number;
  /** Lowest file offset of any non-empty, non-zerofill section: load commands may grow up to here. */
  readonly firstSectionOffset: number;
}

export interface FatArch {
  readonly cputype: number;
  readonly cpusubtype: number;
  readonly offset: number;
  readonly size: number;
  /** Power-of-two alignment exponent (normally 14). */
  readonly align: number;
}

export interface MachOFile {
  /** Present for universal binaries; `slices[i]` corresponds to `fat[i]`. */
  readonly fat: readonly FatArch[] | undefined;
  readonly slices: readonly Slice[];
}
