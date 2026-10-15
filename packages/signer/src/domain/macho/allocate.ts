import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { alignUp, alignUpBig } from '@signer/domain/macho/align.ts'
import {
  LC_CODE_SIGNATURE,
  LINKEDIT_DATA_COMMAND_SIZE
} from '@signer/domain/macho/constants.ts'
import type {
  CodeSignatureCommand,
  Segment,
  Slice
} from '@signer/domain/macho/types.ts'

/** CodeDirectory header size Apple uses for estimates (the v0x20500 header). */
const CD_ESTIMATE_HEADER = 96

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

/** Bytes the signature may cover before it: the old signature's start, or the whole slice. */
const sourceExtent = (slice: Slice): number =>
  slice.codeSignature?.dataoff ?? slice.bytes.byteLength

/** One CodeDirectory's estimated size: header, NUL-terminated strings and every slot hash. */
const estimateCodeDirectory = (
  cd: CodeDirectoryEstimate,
  extent: number
): number =>
  CD_ESTIMATE_HEADER +
  cd.identifierLength +
  1 +
  (cd.teamIdLength ? cd.teamIdLength + 1 : 0) +
  (Math.ceil(extent / cd.pageSize) + cd.nSpecialSlots) * cd.hashSize

/**
 * Signature reservation exactly as codesign computes it (so `LC_CODE_SIGNATURE.datasize`, and
 * therefore page 0's hash, match Apple byte-for-byte).
 */
export const estimateSignatureSize = (
  slice: Slice,
  estimate: SignatureEstimate
): number => {
  const extent = sourceExtent(slice)
  const count = estimate.pieces.length + estimate.codeDirectories.length + 1
  const pieces = estimate.pieces.reduce(
    (sum, piece) => sum + piece.byteLength,
    0
  )
  const cds = estimate.codeDirectories.reduce(
    (sum, cd) => sum + estimateCodeDirectory(cd, extent),
    0
  )

  return alignUp(12 + 8 * count + pieces + cds + estimate.cmsReservation, 16)
}

/** `guess_align` from cctools: trailing zero bits of vmaddr clamped to [lo, 15]. */
const guessAlign = (vmaddr: bigint, low: number): number => {
  if (vmaddr === 0n) return 15
  let zeros = 0
  for (let v = vmaddr; (v & 1n) === 0n && zeros < 15; v >>= 1n) zeros++
  return Math.min(Math.max(zeros, low), 15)
}

const segmentAlignment = (slice: Slice): bigint => {
  const low = slice.is64 ? 3 : 2
  const exponent = Math.min(
    ...slice.segments.map((segment) => guessAlign(segment.vmaddr, low))
  )

  return 1n << BigInt(exponent)
}

const linkeditOf = (slice: Slice): Segment => {
  const linkedit = slice.segments.find(
    (segment) => segment.name === '__LINKEDIT'
  )
  if (!linkedit)
    throw new LoadstarError(ErrorCode.InvalidMachO, {
      message: 'no __LINKEDIT segment'
    })
  const last = slice.segments.reduce((a, b) =>
    b.fileoff >= a.fileoff && b.filesize > 0n ? b : a
  )
  if (last !== linkedit) {
    throw new LoadstarError(ErrorCode.InvalidMachO, {
      message: '__LINKEDIT is not the last segment in the file'
    })
  }
  return linkedit
}

export type PreparedImage = {
  /** Final slice bytes: patched header + code + zero padding, sized `dataoff + datasize`. */
  readonly image: Uint8Array
  /** Where the SuperBlob goes; everything before it is hashed by the CodeDirectory. */
  readonly codeLimit: number
  readonly datasize: number
  readonly addedLoadCommand: boolean
}

/**
 * Where LC_CODE_SIGNATURE lives: the existing command, or a new one appended after the load
 * commands (which must still end before the first section's data).
 */
const signatureCommandOffset = (
  slice: Slice,
  existing: CodeSignatureCommand | undefined,
  linkeditEnd: number
): number => {
  if (existing && existing.dataoff + existing.datasize > linkeditEnd) {
    throw new LoadstarError(ErrorCode.InvalidMachO, {
      message: 'code signature extends past __LINKEDIT'
    })
  }
  const commandOffset =
    existing?.commandOffset ?? slice.headerSize + slice.sizeofcmds
  if (
    !existing &&
    commandOffset + LINKEDIT_DATA_COMMAND_SIZE > slice.firstSectionOffset
  ) {
    throw new LoadstarError(ErrorCode.NoHeaderSpace, {
      message:
        'no room for LC_CODE_SIGNATURE (relink with a larger -headerpad)',
      data: {
        needed: commandOffset + LINKEDIT_DATA_COMMAND_SIZE,
        available: slice.firstSectionOffset
      }
    })
  }
  return commandOffset
}

/** Writes LC_CODE_SIGNATURE (and, when it is new, bumps ncmds/sizeofcmds). Load commands are little-endian. */
const writeSignatureCommand = (
  view: DataView,
  slice: Slice,
  command: {
    readonly offset: number
    readonly isNew: boolean
    readonly dataoff: number
    readonly datasize: number
  }
): void => {
  if (command.isNew) {
    view.setUint32(16, slice.ncmds + 1, true)
    view.setUint32(20, slice.sizeofcmds + LINKEDIT_DATA_COMMAND_SIZE, true)
    view.setUint32(command.offset, LC_CODE_SIGNATURE, true)
    view.setUint32(command.offset + 4, LINKEDIT_DATA_COMMAND_SIZE, true)
  }
  view.setUint32(command.offset + 8, command.dataoff, true)
  view.setUint32(command.offset + 12, command.datasize, true)
}

/** Grows __LINKEDIT's filesize (and vmsize, segment-aligned, when needed) to end at `total`. Little-endian. */
const growLinkedit = (
  view: DataView,
  slice: Slice,
  linkedit: Segment,
  total: number
): void => {
  const newFilesize = BigInt(total) - linkedit.fileoff
  const newVmsize =
    newFilesize > linkedit.vmsize
      ? alignUpBig(newFilesize, segmentAlignment(slice))
      : linkedit.vmsize
  if (slice.is64) {
    view.setBigUint64(linkedit.commandOffset + 32, newVmsize, true)
    view.setBigUint64(linkedit.commandOffset + 48, newFilesize, true)
  } else {
    view.setUint32(linkedit.commandOffset + 28, Number(newVmsize), true)
    view.setUint32(linkedit.commandOffset + 36, Number(newFilesize), true)
  }
}

/**
 * Reserve `datasize` bytes of signature in a slice, adding LC_CODE_SIGNATURE if needed and
 * growing __LINKEDIT, following codesign_allocate. Bytes after the future SuperBlob keep the
 * input's bytes (stale signature data on re-sign), as Apple does.
 */
export const prepareImage = (slice: Slice, datasize: number): PreparedImage => {
  const linkedit = linkeditOf(slice)
  const existing = slice.codeSignature
  const linkeditEnd = Number(linkedit.fileoff + linkedit.filesize)
  const commandOffset = signatureCommandOffset(slice, existing, linkeditEnd)

  const dataoff = alignUp(existing ? existing.dataoff : linkeditEnd, 16)
  const total = dataoff + datasize
  const image = new Uint8Array(total)
  image.set(slice.bytes.subarray(0, Math.min(total, slice.bytes.byteLength)))
  // the region the CodeDirectory hashes ends at dataoff: zero anything the input had between its
  // content and the (16-aligned) signature start
  image.fill(0, Math.min(linkeditEnd, dataoff), dataoff)

  const view = new DataView(image.buffer)
  writeSignatureCommand(view, slice, {
    offset: commandOffset,
    isNew: !existing,
    dataoff,
    datasize
  })
  growLinkedit(view, slice, linkedit, total)

  return { image, codeLimit: dataoff, datasize, addedLoadCommand: !existing }
}
