import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

/** Raw data hashed into the special slots (each CD hashes it with its own algorithm). */
export type SpecialSlotData = {
  /** Slot −1: the bundle's Info.plist bytes as on disk. */
  readonly infoPlist?: Uint8Array
  /** Slot −2: the complete requirement-set blob. Always present in practice. */
  readonly requirements?: Uint8Array
  /** Slot −3: `_CodeSignature/CodeResources` bytes. */
  readonly codeResources?: Uint8Array
  /** Slot −5: the complete XML entitlements blob. */
  readonly entitlements?: Uint8Array
  /** Slot −7: the complete DER entitlements blob. */
  readonly derEntitlements?: Uint8Array
}

export type ExecSegment = {
  readonly base: bigint
  readonly limit: bigint
  readonly flags: bigint
}

export type CodeDirectoryInput = {
  readonly identifier: string
  readonly teamId?: string
  readonly flags: number
  readonly hashType: HashAlgorithm
  readonly pageSize: number
  /** Final image of the slice; bytes `[0, codeLimit)` are hashed (header already patched). */
  readonly image: Uint8Array
  readonly codeLimit: number
  /** Absent when the slice has no platform load command (then the fields are 0). */
  readonly execSegment?: ExecSegment
  readonly special: SpecialSlotData
}

export type CodeDirectoryInfo = {
  readonly version: number
  readonly flags: number
  readonly hashType: number
  readonly hashSize: number
  readonly pageSize: number
  readonly identifier: string
  readonly teamId: string | undefined
  readonly nSpecialSlots: number
  readonly nCodeSlots: number
  readonly codeLimit: number
  readonly execSegFlags: bigint
}
