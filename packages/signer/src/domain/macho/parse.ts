import { ByteReader, compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { DEFAULT_SIGNER_LIMITS } from '@signer/domain/config.ts'
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
  MIN_VERSION_PLATFORM,
  Platform,
  SECTION_64_SIZE,
  SECTION_SIZE,
  SECTION_TYPE_MASK,
  SEGMENT_COMMAND_64_SIZE,
  SEGMENT_COMMAND_SIZE,
  ZEROFILL_TYPES
} from '@signer/domain/macho/constants.ts'
import type {
  FatArch,
  LoadCommandReader,
  LoadCommandScan,
  MachHeader,
  MachOFile,
  Segment,
  Slice
} from '@signer/domain/macho/types.ts'
import type { MachOLimits } from '@signer/domain/types.ts'

const invalid = (
  message: string,
  data?: Record<string, unknown>
): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidMachO, compact({ message, data }))

/** True when `bytes` starts with a thin or fat Mach-O magic (used to discover nested code). */
export const isMachO = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < 4) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, 4)
  const le = view.getUint32(0, true)
  const be = view.getUint32(0, false)

  return le === MH_MAGIC || le === MH_MAGIC_64 || be === FAT_MAGIC
}

// ---- fat header (big-endian) -----------------------------------------------------------------

const readFatArch = (
  reader: ByteReader,
  index: number,
  fileSize: number
): FatArch => {
  const arch: FatArch = {
    cputype: reader.i32be(),
    cpusubtype: reader.i32be(),
    offset: reader.u32be(),
    size: reader.u32be(),
    align: reader.u32be()
  }
  if (arch.offset + arch.size > fileSize || arch.align > 20) {
    throw invalid('fat slice out of bounds', {
      index,
      offset: arch.offset,
      size: arch.size
    })
  }
  return arch
}

/**
 * Slices must not overlap each other or the header: overlapping slices would let one region be
 * signed (and copied) many times, multiplying output size past the archive's size limits.
 */
const assertDisjointSlices = (
  arches: readonly FatArch[],
  headerEnd: number
): void => {
  const sorted = [...arches].sort((a, b) => a.offset - b.offset)
  sorted.forEach((arch, i) => {
    const previousEnd =
      i === 0
        ? headerEnd
        : (sorted[i - 1] as FatArch).offset + (sorted[i - 1] as FatArch).size
    if (arch.size === 0 || arch.offset < previousEnd) {
      throw invalid('fat slices overlap or are empty', {
        offset: arch.offset,
        size: arch.size
      })
    }
  })
}

const parseFatHeader = (bytes: Uint8Array, maxArches: number): FatArch[] => {
  const reader = new ByteReader(bytes, 4)
  const count = reader.u32be()
  const headerEnd = FAT_HEADER_SIZE + count * FAT_ARCH_SIZE
  if (count === 0 || count > maxArches || headerEnd > bytes.byteLength) {
    throw invalid('bad fat header', { count })
  }
  const arches = Array.from({ length: count }, (_, index) =>
    readFatArch(reader, index, bytes.byteLength)
  )
  assertDisjointSlices(arches, headerEnd)
  return arches
}

// ---- thin slice (little-endian) --------------------------------------------------------------

const readMachHeader = (bytes: Uint8Array, fileOffset: number): MachHeader => {
  const header = new ByteReader(bytes)
  if (bytes.byteLength < MH_HEADER_SIZE)
    throw invalid('slice too small', { fileOffset })
  const magic = header.u32le()
  if (magic !== MH_MAGIC && magic !== MH_MAGIC_64) {
    throw invalid('not a Mach-O slice', {
      fileOffset,
      magic: magic.toString(16)
    })
  }
  const is64 = magic === MH_MAGIC_64
  const headerSize = is64 ? MH_HEADER_SIZE_64 : MH_HEADER_SIZE
  const cputype = header.i32le()
  const cpusubtype = header.i32le()
  const filetype = header.u32le()
  const ncmds = header.u32le()
  const sizeofcmds = header.u32le()
  if (headerSize + sizeofcmds > bytes.byteLength)
    throw invalid('load commands exceed file', { sizeofcmds })
  if (ncmds > sizeofcmds / 8)
    throw invalid('more load commands than fit in sizeofcmds', {
      ncmds,
      sizeofcmds
    })
  return { is64, headerSize, cputype, cpusubtype, filetype, ncmds, sizeofcmds }
}

/** Lowest file offset of a segment's sections that occupy file data (zerofill sections do not). */
const firstSectionDataOffset = (
  bytes: Uint8Array,
  sectionsStart: number,
  nsects: number,
  is64: boolean
): number => {
  // section_64: offset@48, size@40 u64, flags@64; section: offset@40, size@36 u32, flags@56
  const sectionSize = is64 ? SECTION_64_SIZE : SECTION_SIZE
  let firstOffset = bytes.byteLength
  for (let k = 0; k < nsects; k++) {
    const s = new ByteReader(bytes, sectionsStart + k * sectionSize)
    s.skip(32 + (is64 ? 8 : 4)) // sectname, segname, addr
    const size = is64 ? Number(s.u64le()) : s.u32le()
    const sectionOffset = s.u32le()
    s.skip(12) // align, reloff, nreloc
    const type = s.u32le() & SECTION_TYPE_MASK
    if (sectionOffset > 0 && size > 0 && !ZEROFILL_TYPES.has(type))
      firstOffset = Math.min(firstOffset, sectionOffset)
  }
  return firstOffset
}

const readSegment = (
  bytes: Uint8Array,
  offset: number,
  cmdsize: number,
  is64: boolean
): { segment: Segment; firstSectionOffset: number } => {
  const r = new ByteReader(bytes, offset + 8)
  const name = r.cstring(16)
  r.seek(offset + 24)
  const vmaddr = is64 ? r.u64le() : BigInt(r.u32le())
  const vmsize = is64 ? r.u64le() : BigInt(r.u32le())
  const fileoff = is64 ? r.u64le() : BigInt(r.u32le())
  const filesize = is64 ? r.u64le() : BigInt(r.u32le())
  r.skip(8) // maxprot, initprot
  const nsects = r.u32le()
  const flags = r.u32le()

  // The segment's file range must lie inside the slice: later steps size buffers from it.
  // Checked even when filesize is 0: allocation uses fileoff + filesize, so a zero-size segment with a
  // huge offset must not slip through.
  if (fileoff + filesize > BigInt(bytes.byteLength)) {
    throw invalid('segment lies outside the file', {
      name,
      fileoff: String(fileoff),
      filesize: String(filesize)
    })
  }

  const sectionSize = is64 ? SECTION_64_SIZE : SECTION_SIZE
  const commandSize = is64 ? SEGMENT_COMMAND_64_SIZE : SEGMENT_COMMAND_SIZE
  if (commandSize + nsects * sectionSize > cmdsize) {
    throw invalid(
      'segment declares more sections than its load command holds',
      { name, nsects, cmdsize }
    )
  }
  return {
    segment: {
      name,
      commandOffset: offset,
      vmaddr,
      vmsize,
      fileoff,
      filesize,
      nsects,
      flags
    },
    firstSectionOffset: firstSectionDataOffset(bytes, r.position, nsects, is64)
  }
}

const readSegmentCommand: LoadCommandReader = (scan, bytes, load) => {
  const segment = readSegment(
    bytes,
    load.offset,
    load.cmdsize,
    load.cmd === LC_SEGMENT_64
  )
  scan.segments.push(segment.segment)
  scan.firstSectionOffset = Math.min(
    scan.firstSectionOffset,
    segment.firstSectionOffset
  )
}

const readCodeSignature: LoadCommandReader = (scan, bytes, load, command) => {
  const signature = {
    commandOffset: load.offset,
    dataoff: command.u32le(),
    datasize: command.u32le()
  }
  if (signature.dataoff + signature.datasize > bytes.byteLength) {
    throw invalid('code signature lies outside the file', {
      ...signature,
      size: bytes.byteLength
    })
  }
  scan.codeSignature = signature
}

const readBuildVersion: LoadCommandReader = (scan, _bytes, _load, command) => {
  scan.buildVersion = { platform: command.u32le(), minOS: command.u32le() }
}

const readVersionMin: LoadCommandReader = (scan, _bytes, load, command) => {
  // LC_BUILD_VERSION wins when both exist (it is the modern form).
  scan.buildVersion ??= {
    platform: MIN_VERSION_PLATFORM[load.cmd] ?? Platform.Unknown,
    minOS: command.u32le()
  }
}

const readUuid: LoadCommandReader = (scan, _bytes, _load, command) => {
  scan.uuid = command.bytes(16).slice()
}

const readEncryptionInfo: LoadCommandReader = (
  scan,
  _bytes,
  _load,
  command
) => {
  command.skip(8) // cryptoff, cryptsize
  scan.cryptid = command.u32le()
}

/** The load commands the signer reads; any other command is skipped. */
const LOAD_COMMAND_READERS: Readonly<
  Partial<Record<number, LoadCommandReader>>
> = {
  [LC_SEGMENT_64]: readSegmentCommand,
  [LC_SEGMENT]: readSegmentCommand,
  [LC_CODE_SIGNATURE]: readCodeSignature,
  [LC_BUILD_VERSION]: readBuildVersion,
  [LC_VERSION_MIN_MACOSX]: readVersionMin,
  [LC_VERSION_MIN_IPHONEOS]: readVersionMin,
  [LC_VERSION_MIN_TVOS]: readVersionMin,
  [LC_VERSION_MIN_WATCHOS]: readVersionMin,
  [LC_UUID]: readUuid,
  [LC_ENCRYPTION_INFO]: readEncryptionInfo,
  [LC_ENCRYPTION_INFO_64]: readEncryptionInfo
}

/** Records one load command; `command` is positioned just after its `cmd`/`cmdsize` fields. */
const readLoadCommand: LoadCommandReader = (scan, bytes, load, command) =>
  LOAD_COMMAND_READERS[load.cmd]?.(scan, bytes, load, command)

const scanLoadCommands = (
  bytes: Uint8Array,
  header: MachHeader
): LoadCommandScan => {
  const scan: LoadCommandScan = {
    segments: [],
    codeSignature: undefined,
    buildVersion: undefined,
    uuid: undefined,
    cryptid: 0,
    firstSectionOffset: bytes.byteLength
  }
  const commandsEnd = header.headerSize + header.sizeofcmds
  let offset = header.headerSize
  for (let i = 0; i < header.ncmds; i++) {
    const command = new ByteReader(bytes, offset)
    const cmd = command.u32le()
    const cmdsize = command.u32le()
    if (cmdsize < 8 || offset + cmdsize > commandsEnd) {
      throw invalid('malformed load command', { index: i, cmd, cmdsize })
    }
    readLoadCommand(scan, bytes, { offset, cmd, cmdsize }, command)
    offset += cmdsize
  }
  return scan
}

/** Parses one thin Mach-O image (load commands only; section data is not read). */
export const parseSlice = (bytes: Uint8Array, fileOffset: number): Slice => {
  const header = readMachHeader(bytes, fileOffset)

  return { fileOffset, bytes, ...header, ...scanLoadCommands(bytes, header) }
}

/** Parses a thin or universal Mach-O file. Throws `signer.invalid_macho` on malformed input. */
export const parseMachO = (
  bytes: Uint8Array,
  limits: MachOLimits = DEFAULT_SIGNER_LIMITS.machO
): MachOFile => {
  if (bytes.byteLength < 4)
    throw invalid('file too small to be Mach-O', { size: bytes.byteLength })
  const magicBE = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(
    0,
    false
  )

  if (magicBE === FAT_MAGIC_64) {
    throw new IPAForgeError(ErrorCode.UnsupportedArch, {
      message: 'fat_arch_64 files are not used on iOS'
    })
  }
  if (magicBE !== FAT_MAGIC)
    return { fat: undefined, slices: [parseSlice(bytes, 0)] }

  const fat = parseFatHeader(bytes, limits.maxFatArches)

  return {
    fat,
    slices: fat.map((arch) =>
      parseSlice(
        bytes.subarray(arch.offset, arch.offset + arch.size),
        arch.offset
      )
    )
  }
}

export const findSegment = (slice: Slice, name: string): Segment | undefined =>
  slice.segments.find((segment) => segment.name === name)
