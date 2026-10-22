// The devices IPAForge knows, so one found on the network can be told apart: each one's UDID and, when known,
// its real Wi-Fi MAC address. Kept in the secret store under one key, as a small JSON list.
import type { KnownWifiDevice } from '@device/domain/types.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/

/** Key under which the known devices are kept. */
export const WIFI_DEVICES_KEY = 'wifi-devices'

/** A MAC address in lower case with colons, or `undefined` when it isn't one. */
export const normalizeMac = (value: string): string | undefined => {
  const mac = value.trim().toLowerCase().replaceAll('-', ':')

  return MAC.test(mac) ? mac : undefined
}

/** The MAC address an advert's instance name starts with (`<MAC>@<address>…`): the real one, or a private one. */
export const macOfInstance = (instance: string): string | undefined => {
  const [prefix] = instance.split('@')

  return prefix === undefined ? undefined : normalizeMac(prefix)
}

const isKnownDevice = (value: unknown): value is KnownWifiDevice =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { udid?: unknown }).udid === 'string' &&
  ['string', 'undefined'].includes(typeof (value as { mac?: unknown }).mac)

export const parseKnownDevices = (
  bytes: Uint8Array | undefined
): KnownWifiDevice[] => {
  if (!bytes) return []
  try {
    const parsed: unknown = JSON.parse(utf8Decode(bytes))

    return Array.isArray(parsed) ? parsed.filter(isKnownDevice) : []
  } catch {
    return []
  }
}

export const serializeKnownDevices = (
  devices: readonly KnownWifiDevice[]
): Uint8Array => utf8Encode(JSON.stringify(devices))
