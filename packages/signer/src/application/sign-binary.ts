import { hashAlgorithmsFor } from '@signer/application/policy.ts'
import { signSlice } from '@signer/application/sign-slice.ts'
import type {
  SignBinaryOptions,
  SignedBinary,
  SignedSlice
} from '@signer/application/types.ts'
import { resolveLimits, resolvePolicy } from '@signer/domain/config.ts'
import { assembleFat } from '@signer/domain/macho/fat.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import type { SigningDeps } from '@signer/types.ts'

/** Signs a thin or universal Mach-O binary; output matches Apple codesign for the same inputs. */
export const signBinary = async (
  bytes: Uint8Array,
  options: SignBinaryOptions,
  deps: SigningDeps
): Promise<SignedBinary> => {
  const started = Date.now()
  options.signal?.throwIfAborted()
  const file = parseMachO(bytes, resolveLimits(options.limits).machO)
  const policy = resolvePolicy(options.policy)
  const algorithms = hashAlgorithmsFor(file.slices, policy.hashAlgorithms)

  const signed: SignedSlice[] = []
  for (const slice of file.slices) {
    options.signal?.throwIfAborted()
    signed.push(await signSlice(slice, options, { algorithms, policy }, deps))
  }
  const output = file.fat
    ? assembleFat(
        file.fat,
        signed.map((s) => s.bytes)
      )
    : (signed[0]?.bytes ?? bytes)

  deps.logger.info('signed binary', {
    identifier: options.identifier,
    mode: options.signing.kind,
    slices: file.slices.length,
    algorithms,
    ms: Date.now() - started
  })
  return { bytes: output, cdhashes: signed.map((s) => s.cdhash) }
}
