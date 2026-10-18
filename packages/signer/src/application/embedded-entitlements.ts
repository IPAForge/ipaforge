import { isPlistDict, parseXmlPlist } from '@ipaforge/kernel'
import type { EntitlementsInput } from '@signer/application/types.ts'
import {
  CSSLOT_ENTITLEMENTS,
  findBlob,
  parseSuperBlob
} from '@signer/domain/blobs/index.ts'
import { DEFAULT_SIGNER_LIMITS } from '@signer/domain/config.ts'
import { parseMachO } from '@signer/domain/macho/parse.ts'
import type { SignerLimits } from '@signer/domain/types.ts'

/**
 * Entitlements currently embedded in a signed executable (slot 5): the exact plist bytes and the
 * parsed dict. `undefined` for unsigned binaries or binaries without entitlements.
 */
export const embeddedEntitlements = (
  executable: Uint8Array | undefined,
  limits: SignerLimits = DEFAULT_SIGNER_LIMITS
): EntitlementsInput | undefined => {
  if (!executable) return undefined
  try {
    const slice = parseMachO(executable, limits.machO).slices[0]
    const sig = slice?.codeSignature
    if (!slice || !sig) return undefined
    const blob = findBlob(
      parseSuperBlob(
        slice.bytes.subarray(sig.dataoff, sig.dataoff + sig.datasize)
      ),
      CSSLOT_ENTITLEMENTS
    )
    if (!blob) return undefined
    const bytes = blob.slice(8)
    const dict = parseXmlPlist(bytes, limits.plist)

    return isPlistDict(dict) ? { bytes, dict } : undefined
  } catch {
    return undefined // malformed signatures are simply replaced
  }
}
