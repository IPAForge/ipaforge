import type { IPAForgeError } from '@ipaforge/kernel'
import type {
  CodePairedDevice,
  PairableDevice
} from '@ui/services/engine/types.ts'

/**
 * Which step of pairing an Apple TV or Vision Pro is on screen. The code step stays on screen, busy, while the
 * device is reached and while it checks a code; a wrong code asks again (`retry`), with a new code on its screen.
 */
export type PairStep =
  | { readonly phase: 'find' }
  | {
      readonly phase: 'code'
      readonly target: PairableDevice
      readonly retry: boolean
      readonly codeLength: number
      /** Counts the questions, so the code boxes empty for each new code. */
      readonly count: number
      readonly isPending: boolean
    }
  /** Too many wrong codes: `until` is when the device takes codes again, when it said. */
  | {
      readonly phase: 'backoff'
      readonly target: PairableDevice
      readonly until: number | undefined
    }
  | { readonly phase: 'closed'; readonly target: PairableDevice }
  | {
      readonly phase: 'failed'
      readonly target: PairableDevice
      readonly error: IPAForgeError
    }
  | { readonly phase: 'done'; readonly paired: CodePairedDevice }

export type UsePairByCode = {
  readonly step: PairStep
  /** Starts pairing with a device the search found. */
  start: (target: PairableDevice) => void
  answer: (code: string) => void
  /** Back to the list, ending a pairing under way. */
  back: () => void
}

/** What the search for devices showing their pairing screen has found so far. */
export type PairableSearch = {
  readonly devices: readonly PairableDevice[]
  /** The OS refuses local network access (macOS). */
  readonly isDenied: boolean
  readonly hasFailed: boolean
}
