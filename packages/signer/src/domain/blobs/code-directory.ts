import { ByteReader, ByteWriter, utf8Encode } from '@loadstar/kernel'
import {
  CS_CDHASH_LEN,
  CS_SUPPORTSCODELIMIT64,
  CS_SUPPORTSEXECSEG,
  CS_SUPPORTSSCATTER,
  CS_SUPPORTSTEAMID,
  CSMAGIC_CODEDIRECTORY,
  FIXED_HEADER_SIZE,
  HASH_TYPE
} from '@signer/domain/blobs/constants.ts'
import type {
  CodeDirectoryInfo,
  CodeDirectoryInput,
  SpecialSlotData
} from '@signer/domain/blobs/types.ts'
import { DIGEST_SIZE } from '@signer/domain/ports/constants.ts'
import type { HashAlgorithm, Hasher } from '@signer/domain/ports/types.ts'

const UINT32_MAX = 0xffffffff

/** Special slots in index order −1 … −7; `undefined` marks unused slots (written as zero hashes). */
const specialSlotList = (
  special: SpecialSlotData
): (Uint8Array | undefined)[] => {
  const slots = [
    special.infoPlist,
    special.requirements,
    special.codeResources,
    undefined, // −4 application-specific
    special.entitlements,
    undefined, // −6 rep-specific
    special.derEntitlements
  ]
  let count = slots.length
  while (count > 0 && slots[count - 1] === undefined) count--
  return slots.slice(0, count) // nSpecialSlots = highest filled slot
}

/** One hash per special slot; unused slots hold zeroes. */
const hashSpecialSlots = (
  specials: readonly (Uint8Array | undefined)[],
  algorithm: HashAlgorithm,
  hasher: Hasher
): Promise<Uint8Array[]> =>
  Promise.all(
    specials.map((data) =>
      data
        ? hasher.digest(algorithm, data)
        : Promise.resolve(new Uint8Array(DIGEST_SIZE[algorithm]))
    )
  )

/** Version per Apple's Builder::build: the oldest format that can carry the fields in use. */
export const codeDirectoryVersion = (
  input: Pick<CodeDirectoryInput, 'execSegment' | 'codeLimit' | 'teamId'>
): number => {
  if (input.execSegment && input.execSegment.limit > 0n)
    return CS_SUPPORTSEXECSEG
  if (input.codeLimit > UINT32_MAX) return CS_SUPPORTSCODELIMIT64
  if (input.teamId) return CS_SUPPORTSTEAMID
  return CS_SUPPORTSSCATTER
}

/** Builds a CodeDirectory blob (byte-identical to Apple `codesign` for the same inputs). */
export const buildCodeDirectory = async (
  input: CodeDirectoryInput,
  hasher: Hasher
): Promise<Uint8Array> => {
  const version = codeDirectoryVersion(input)
  const headerSize = FIXED_HEADER_SIZE[version] as number
  const hashSize = DIGEST_SIZE[input.hashType]
  const identifier = utf8Encode(`${input.identifier}\0`)
  const team = input.teamId ? utf8Encode(`${input.teamId}\0`) : undefined
  const specials = specialSlotList(input.special)

  const codeLimit = Math.min(input.codeLimit, input.image.byteLength)
  const codeHashes = await hasher.digestPages(
    input.hashType,
    input.image.subarray(0, codeLimit),
    input.pageSize
  )
  const specialHashes = await hashSpecialSlots(specials, input.hashType, hasher)

  const identOffset = headerSize
  const teamOffset = team ? identOffset + identifier.byteLength : 0
  const hashOffset =
    identOffset +
    identifier.byteLength +
    (team?.byteLength ?? 0) +
    specials.length * hashSize
  const length = hashOffset + codeHashes.length * hashSize

  const w = new ByteWriter(length)
    .u32be(CSMAGIC_CODEDIRECTORY)
    .u32be(length)
    .u32be(version)
    .u32be(input.flags)
    .u32be(hashOffset)
    .u32be(identOffset)
    .u32be(specials.length)
    .u32be(codeHashes.length)
    .u32be(codeLimit > UINT32_MAX ? UINT32_MAX : codeLimit)
    .u8(hashSize)
    .u8(HASH_TYPE[input.hashType])
    .u8(0) // platform
    .u8(Math.log2(input.pageSize))
    .u32be(0) // spare2
    .u32be(0) // scatterOffset
  if (version >= CS_SUPPORTSTEAMID) w.u32be(teamOffset)
  if (version >= CS_SUPPORTSCODELIMIT64)
    w.u32be(0).u64be(codeLimit > UINT32_MAX ? BigInt(codeLimit) : 0n)
  if (version >= CS_SUPPORTSEXECSEG) {
    w.u64be(input.execSegment?.base ?? 0n)
      .u64be(input.execSegment?.limit ?? 0n)
      .u64be(input.execSegment?.flags ?? 0n)
  }

  w.bytes(identifier)
  if (team) w.bytes(team)
  // special slots are stored highest-first (−n … −1), immediately before hashOffset
  for (let i = specialHashes.length - 1; i >= 0; i--)
    w.bytes(specialHashes[i] as Uint8Array)
  for (const hash of codeHashes) w.bytes(hash)
  return w.toBytes()
}

/** Reads the header fields of a CodeDirectory (used in tests and diagnostics). */
export const parseCodeDirectory = (cd: Uint8Array): CodeDirectoryInfo => {
  const r = new ByteReader(cd)
  r.skip(8)
  const version = r.u32be()
  const flags = r.u32be()
  r.skip(4) // hashOffset
  const identOffset = r.u32be()
  const nSpecialSlots = r.u32be()
  const nCodeSlots = r.u32be()
  const codeLimit = r.u32be()
  const hashSize = r.u8()
  const hashType = r.u8()
  r.skip(1)
  const pageSize = 2 ** r.u8()
  const teamOffset =
    version >= CS_SUPPORTSTEAMID ? new ByteReader(cd, 0x30).u32be() : 0
  const execSegFlags =
    version >= CS_SUPPORTSEXECSEG ? new ByteReader(cd, 0x50).u64be() : 0n

  return {
    version,
    flags,
    hashType,
    hashSize,
    pageSize,
    identifier: new ByteReader(cd, identOffset).cstring(),
    teamId: teamOffset ? new ByteReader(cd, teamOffset).cstring() : undefined,
    nSpecialSlots,
    nCodeSlots,
    codeLimit,
    execSegFlags
  }
}

/** cdhash: the CD's own hash of the whole blob, truncated to 20 bytes. */
export const cdHash = async (
  cd: Uint8Array,
  algorithm: HashAlgorithm,
  hasher: Hasher
): Promise<Uint8Array> =>
  (await hasher.digest(algorithm, cd)).subarray(0, CS_CDHASH_LEN)
