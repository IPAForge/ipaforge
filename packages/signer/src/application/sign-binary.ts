import { hashAlgorithmsFor } from "@signer/application/policy.ts";
import { type SignedSlice, signSlice } from "@signer/application/sign-slice.ts";
import type { SignatureContent } from "@signer/application/signing.ts";
import type { SigningDeps } from "@signer/deps.ts";
import {
  type Overrides,
  resolveLimits,
  resolvePolicy,
  type SignerLimits,
  type SigningPolicy,
} from "@signer/domain/config.ts";
import { assembleFat } from "@signer/domain/macho/fat.ts";
import { parseMachO } from "@signer/domain/macho/parse.ts";

export interface SignBinaryOptions extends SignatureContent {
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>;
  /** Parser limits for hostile-input protection (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>;
  readonly signal?: AbortSignal;
}

export interface SignedBinary {
  readonly bytes: Uint8Array;
  /** cdhash (20 bytes) of each slice's primary CodeDirectory. */
  readonly cdhashes: readonly Uint8Array[];
}

/** Signs a thin or universal Mach-O binary; output matches Apple codesign for the same inputs. */
export const signBinary = async (
  bytes: Uint8Array,
  options: SignBinaryOptions,
  deps: SigningDeps,
): Promise<SignedBinary> => {
  const started = Date.now();
  options.signal?.throwIfAborted();
  const file = parseMachO(bytes, resolveLimits(options.limits).machO);
  const policy = resolvePolicy(options.policy);
  const algorithms = hashAlgorithmsFor(file.slices, policy.hashAlgorithms);

  const signed: SignedSlice[] = [];
  for (const slice of file.slices) {
    options.signal?.throwIfAborted();
    signed.push(await signSlice(slice, options, { algorithms, policy }, deps));
  }
  const output = file.fat
    ? assembleFat(
        file.fat,
        signed.map((s) => s.bytes),
      )
    : (signed[0]?.bytes ?? bytes);

  deps.logger.info("signed binary", {
    identifier: options.identifier,
    mode: options.signing.kind,
    slices: file.slices.length,
    algorithms,
    ms: Date.now() - started,
  });
  return { bytes: output, cdhashes: signed.map((s) => s.cdhash) };
};
