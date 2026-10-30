// The devices paired by code (Apple TV, Apple Vision Pro): each one's UDID, and the name and model it gave. Kept in
// the secret store under one key, as a small JSON list, beside each one's remote pairing.
import type { CodePairedDevice } from '@device/domain/types.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

/** Key under which the devices paired by code are kept. */
export const CODE_PAIRED_KEY = 'code-paired-devices'

const optionalText = (value: unknown): boolean =>
  value === undefined || typeof value === 'string'

const isCodePaired = (value: unknown): value is CodePairedDevice => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>

  return (
    typeof entry.udid === 'string' &&
    optionalText(entry.name) &&
    optionalText(entry.model)
  )
}

export const parseCodePaired = (
  bytes: Uint8Array | undefined
): CodePairedDevice[] => {
  if (!bytes) return []
  try {
    const parsed: unknown = JSON.parse(utf8Decode(bytes))

    return Array.isArray(parsed) ? parsed.filter(isCodePaired) : []
  } catch {
    return []
  }
}

export const serializeCodePaired = (
  devices: readonly CodePairedDevice[]
): Uint8Array => utf8Encode(JSON.stringify(devices))
