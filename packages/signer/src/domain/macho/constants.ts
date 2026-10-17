// Mach-O constants (names match <mach-o/loader.h> and <mach-o/fat.h> so they stay grep-able).

export const MH_MAGIC = 0xfeedface // 32-bit, little-endian on disk
export const MH_MAGIC_64 = 0xfeedfacf // 64-bit, little-endian on disk
export const FAT_MAGIC = 0xcafebabe // big-endian on disk
export const FAT_MAGIC_64 = 0xcafebabf // not used for iOS

export const MH_HEADER_SIZE = 28
export const MH_HEADER_SIZE_64 = 32
export const FAT_HEADER_SIZE = 8
export const FAT_ARCH_SIZE = 20

export const MH_EXECUTE = 0x2
export const MH_DYLIB = 0x6
export const MH_BUNDLE = 0x8

export const CPU_TYPE_ARM = 12
export const CPU_TYPE_ARM64 = 0x0100000c
export const CPU_TYPE_ARM64_32 = 0x0200000c
export const CPU_TYPE_X86_64 = 0x01000007

/** Capability bits in the high byte of cpusubtype (arm64e sets its pointer-authentication ABI version there). */
export const CPU_SUBTYPE_MASK = 0xff000000
export const CPU_SUBTYPE_ARM_V6 = 6
export const CPU_SUBTYPE_ARM_V7 = 9
export const CPU_SUBTYPE_ARM_V7S = 11
export const CPU_SUBTYPE_ARM_V7K = 12
export const CPU_SUBTYPE_ARM64_ALL = 0
export const CPU_SUBTYPE_ARM64_V8 = 1
export const CPU_SUBTYPE_ARM64E = 2
export const CPU_SUBTYPE_ARM64_32_V8 = 1
export const CPU_SUBTYPE_X86_64_ALL = 3

/** Architecture names as `lipo` and `file` print them. */
export const Architecture = {
  Arm64: 'arm64',
  Arm64e: 'arm64e',
  Arm64_32: 'arm64_32',
  Armv6: 'armv6',
  Armv7: 'armv7',
  Armv7s: 'armv7s',
  Armv7k: 'armv7k',
  X86_64: 'x86_64'
} as const
export type Architecture = (typeof Architecture)[keyof typeof Architecture]

export const LC_SEGMENT = 0x1
export const LC_SEGMENT_64 = 0x19
export const LC_UUID = 0x1b
export const LC_CODE_SIGNATURE = 0x1d
export const LC_ENCRYPTION_INFO = 0x21
export const LC_VERSION_MIN_MACOSX = 0x24
export const LC_VERSION_MIN_IPHONEOS = 0x25
export const LC_ENCRYPTION_INFO_64 = 0x2c
export const LC_VERSION_MIN_TVOS = 0x2f
export const LC_VERSION_MIN_WATCHOS = 0x30
export const LC_BUILD_VERSION = 0x32

export const LINKEDIT_DATA_COMMAND_SIZE = 16
/** segment_command / segment_command_64 and section / section_64 structure sizes. */
export const SEGMENT_COMMAND_SIZE = 56
export const SEGMENT_COMMAND_64_SIZE = 72
export const SECTION_SIZE = 68
export const SECTION_64_SIZE = 80

// section_64.flags & SECTION_TYPE
export const SECTION_TYPE_MASK = 0xff
export const S_ZEROFILL = 0x1
export const S_GB_ZEROFILL = 0xc
export const S_THREAD_LOCAL_ZEROFILL = 0x12

/** Platform identifiers from LC_BUILD_VERSION. */
export const Platform = {
  Unknown: 0,
  MacOS: 1,
  IOS: 2,
  TvOS: 3,
  WatchOS: 4
} as const

/** The platform each legacy LC_VERSION_MIN_* command implies. */
export const MIN_VERSION_PLATFORM: Readonly<Record<number, number>> = {
  [LC_VERSION_MIN_MACOSX]: Platform.MacOS,
  [LC_VERSION_MIN_IPHONEOS]: Platform.IOS,
  [LC_VERSION_MIN_TVOS]: Platform.TvOS,
  [LC_VERSION_MIN_WATCHOS]: Platform.WatchOS
}

/** Section types with no file data. */
export const ZEROFILL_TYPES = new Set([
  S_ZEROFILL,
  S_GB_ZEROFILL,
  S_THREAD_LOCAL_ZEROFILL
])
