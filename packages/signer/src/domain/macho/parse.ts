import { ByteReader, ErrorCode, LoadstarError } from "@loadstar/kernel";
import { DEFAULT_SIGNER_LIMITS, type MachOLimits } from "@signer/domain/config.ts";
import {
  FAT_ARCH_SIZE,
  FAT_HEADER_SIZE,
  FAT_MAGIC,
  FAT_MAGIC_64,
  LC_BUILD_VERSION,
  LC_CODE_SIGNATURE,
  LC_ENCRYPTION_INFO,
  LC_ENCRYPTION_INFO_64,
  LC_SEGMENT,
  LC_SEGMENT_64,
  LC_UUID,
  LC_VERSION_MIN_IPHONEOS,
  LC_VERSION_MIN_MACOSX,
  LC_VERSION_MIN_TVOS,
  LC_VERSION_MIN_WATCHOS,
  MH_HEADER_SIZE,
  MH_HEADER_SIZE_64,
  MH_MAGIC,
  MH_MAGIC_64,
  Platform,
  S_GB_ZEROFILL,
  S_THREAD_LOCAL_ZEROFILL,
  S_ZEROFILL,
  SECTION_TYPE_MASK,
} from "@signer/domain/macho/constants.ts";
import type {
  BuildVersion,
  CodeSignatureCommand,
  FatArch,
  MachOFile,
  Segment,
  Slice,
} from "@signer/domain/macho/types.ts";

const invalid = (message: string, data?: Record<string, unknown>): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidMachO, { message, ...(data ? { data } : {}) });

const MIN_VERSION_PLATFORM: Readonly<Record<number, number>> = {
  [LC_VERSION_MIN_MACOSX]: Platform.MacOS,
  [LC_VERSION_MIN_IPHONEOS]: Platform.IOS,
  [LC_VERSION_MIN_TVOS]: Platform.TvOS,
  [LC_VERSION_MIN_WATCHOS]: Platform.WatchOS,
};

/** True when `bytes` starts with a thin or fat Mach-O magic (used to discover nested code). */
export const isMachO = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < 4) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, 4);
  const le = view.getUint32(0, true);
  const be = view.getUint32(0, false);
  return le === MH_MAGIC || le === MH_MAGIC_64 || be === FAT_MAGIC;
};

/** Parses a thin or universal Mach-O file. Throws `signer.invalid_macho` on malformed input. */
export const parseMachO = (bytes: Uint8Array, limits: MachOLimits = DEFAULT_SIGNER_LIMITS.machO): MachOFile => {
  if (bytes.byteLength < 4) throw invalid("file too small to be Mach-O", { size: bytes.byteLength });
  const magicBE = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);

  if (magicBE === FAT_MAGIC_64) {
    throw new LoadstarError(ErrorCode.UnsupportedArch, { message: "fat_arch_64 files are not used on iOS" });
  }
  if (magicBE !== FAT_MAGIC) return { fat: undefined, slices: [parseSlice(bytes, 0)] };

  const fat = parseFatHeader(bytes, limits.maxFatArches);
  return {
    fat,
    slices: fat.map((arch) => parseSlice(bytes.subarray(arch.offset, arch.offset + arch.size), arch.offset)),
  };
};

const parseFatHeader = (bytes: Uint8Array, maxArches: number): FatArch[] => {
  const reader = new ByteReader(bytes, 4);
  const count = reader.u32be();
  if (count === 0 || count > maxArches || FAT_HEADER_SIZE + count * FAT_ARCH_SIZE > bytes.byteLength) {
    throw invalid("bad fat header", { count });
  }
  const arches: FatArch[] = [];
  for (let i = 0; i < count; i++) {
    const arch: FatArch = {
      cputype: reader.i32be(),
      cpusubtype: reader.i32be(),
      offset: reader.u32be(),
      size: reader.u32be(),
      align: reader.u32be(),
    };
    if (arch.offset + arch.size > bytes.byteLength || arch.align > 20) {
      throw invalid("fat slice out of bounds", { index: i, offset: arch.offset, size: arch.size });
    }
    arches.push(arch);
  }
  // Slices must not overlap each other or the header: overlapping slices would let one region be
  // signed (and copied) many times, multiplying output size past the archive's size limits.
  const headerEnd = FAT_HEADER_SIZE + count * FAT_ARCH_SIZE;
  const sorted = [...arches].sort((a, b) => a.offset - b.offset);
  sorted.forEach((arch, i) => {
    const previousEnd = i === 0 ? headerEnd : (sorted[i - 1] as FatArch).offset + (sorted[i - 1] as FatArch).size;
    if (arch.size === 0 || arch.offset < previousEnd) {
      throw invalid("fat slices overlap or are empty", { offset: arch.offset, size: arch.size });
    }
  });
  return arches;
};

/** Parses one thin Mach-O image (load commands only; section data is not read). */
export const parseSlice = (bytes: Uint8Array, fileOffset: number): Slice => {
  const header = new ByteReader(bytes);
  if (bytes.byteLength < MH_HEADER_SIZE) throw invalid("slice too small", { fileOffset });
  const magic = header.u32le();
  if (magic !== MH_MAGIC && magic !== MH_MAGIC_64) {
    throw invalid("not a Mach-O slice", { fileOffset, magic: magic.toString(16) });
  }
  const is64 = magic === MH_MAGIC_64;
  const headerSize = is64 ? MH_HEADER_SIZE_64 : MH_HEADER_SIZE;
  const cputype = header.i32le();
  const cpusubtype = header.i32le();
  const filetype = header.u32le();
  const ncmds = header.u32le();
  const sizeofcmds = header.u32le();
  if (headerSize + sizeofcmds > bytes.byteLength) throw invalid("load commands exceed file", { sizeofcmds });
  if (ncmds > sizeofcmds / 8) throw invalid("more load commands than fit in sizeofcmds", { ncmds, sizeofcmds });

  const segments: Segment[] = [];
  let codeSignature: CodeSignatureCommand | undefined;
  let buildVersion: BuildVersion | undefined;
  let uuid: Uint8Array | undefined;
  let cryptid = 0;
  let firstSectionOffset = bytes.byteLength;

  let offset = headerSize;
  for (let i = 0; i < ncmds; i++) {
    const command = new ByteReader(bytes, offset);
    const cmd = command.u32le();
    const cmdsize = command.u32le();
    if (cmdsize < 8 || offset + cmdsize > headerSize + sizeofcmds) {
      throw invalid("malformed load command", { index: i, cmd, cmdsize });
    }

    switch (cmd) {
      case LC_SEGMENT_64:
      case LC_SEGMENT: {
        const segment = readSegment(bytes, offset, cmdsize, cmd === LC_SEGMENT_64);
        segments.push(segment.segment);
        firstSectionOffset = Math.min(firstSectionOffset, segment.firstSectionOffset);
        break;
      }
      case LC_CODE_SIGNATURE: {
        const signature = { commandOffset: offset, dataoff: command.u32le(), datasize: command.u32le() };
        if (signature.dataoff + signature.datasize > bytes.byteLength) {
          throw invalid("code signature lies outside the file", { ...signature, size: bytes.byteLength });
        }
        codeSignature = signature;
        break;
      }
      case LC_BUILD_VERSION:
        buildVersion = { platform: command.u32le(), minOS: command.u32le() };
        break;
      case LC_VERSION_MIN_MACOSX:
      case LC_VERSION_MIN_IPHONEOS:
      case LC_VERSION_MIN_TVOS:
      case LC_VERSION_MIN_WATCHOS:
        // LC_BUILD_VERSION wins when both exist (it is the modern form).
        buildVersion ??= { platform: MIN_VERSION_PLATFORM[cmd] ?? Platform.Unknown, minOS: command.u32le() };
        break;
      case LC_UUID:
        uuid = command.bytes(16).slice();
        break;
      case LC_ENCRYPTION_INFO:
      case LC_ENCRYPTION_INFO_64:
        command.skip(8); // cryptoff, cryptsize
        cryptid = command.u32le();
        break;
    }
    offset += cmdsize;
  }

  return {
    fileOffset,
    bytes,
    is64,
    headerSize,
    cputype,
    cpusubtype,
    filetype,
    ncmds,
    sizeofcmds,
    segments,
    codeSignature,
    buildVersion,
    uuid,
    cryptid,
    firstSectionOffset,
  };
};

const ZEROFILL_TYPES = new Set([S_ZEROFILL, S_GB_ZEROFILL, S_THREAD_LOCAL_ZEROFILL]);

const readSegment = (
  bytes: Uint8Array,
  offset: number,
  cmdsize: number,
  is64: boolean,
): { segment: Segment; firstSectionOffset: number } => {
  const r = new ByteReader(bytes, offset + 8);
  const name = r.cstring(16);
  r.seek(offset + 24);
  const vmaddr = is64 ? r.u64le() : BigInt(r.u32le());
  const vmsize = is64 ? r.u64le() : BigInt(r.u32le());
  const fileoff = is64 ? r.u64le() : BigInt(r.u32le());
  const filesize = is64 ? r.u64le() : BigInt(r.u32le());
  r.skip(8); // maxprot, initprot
  const nsects = r.u32le();
  const flags = r.u32le();

  // The segment's file range must lie inside the slice: later steps size buffers from it.
  // Checked even when filesize is 0: allocation uses fileoff + filesize, so a zero-size segment with a
  // huge offset must not slip through.
  if (fileoff + filesize > BigInt(bytes.byteLength)) {
    throw invalid("segment lies outside the file", { name, fileoff: String(fileoff), filesize: String(filesize) });
  }

  // section_64: 80 bytes (offset@48, size@40 u64, flags@64); section: 68 bytes (offset@40, size@36 u32, flags@56)
  const sectionSize = is64 ? 80 : 68;
  const headerSize = is64 ? 72 : 56;
  if (headerSize + nsects * sectionSize > cmdsize) {
    throw invalid("segment declares more sections than its load command holds", { name, nsects, cmdsize });
  }
  let firstSectionOffset = bytes.byteLength;
  for (let k = 0; k < nsects; k++) {
    const s = new ByteReader(bytes, r.position + k * sectionSize);
    s.skip(32 + (is64 ? 8 : 4)); // sectname, segname, addr
    const size = is64 ? Number(s.u64le()) : s.u32le();
    const sectionOffset = s.u32le();
    s.skip(12); // align, reloff, nreloc
    const type = s.u32le() & SECTION_TYPE_MASK;
    if (sectionOffset > 0 && size > 0 && !ZEROFILL_TYPES.has(type)) {
      firstSectionOffset = Math.min(firstSectionOffset, sectionOffset);
    }
  }
  return {
    segment: { name, commandOffset: offset, vmaddr, vmsize, fileoff, filesize, nsects, flags },
    firstSectionOffset,
  };
};

export const findSegment = (slice: Slice, name: string): Segment | undefined =>
  slice.segments.find((segment) => segment.name === name);
