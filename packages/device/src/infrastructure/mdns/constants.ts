/** The mDNS IPv4 multicast group and port every query goes to (RFC 6762: fixed by the protocol). */
// eslint-disable-next-line sonarjs/no-hardcoded-ip -- the mDNS group is part of the protocol, never configurable
export const MDNS_GROUP = '224.0.0.251'
export const MDNS_PORT = 5353

/** The DNS record types device adverts use. */
export const RecordType = {
  A: 1,
  PTR: 12,
  TXT: 16,
  AAAA: 28,
  SRV: 33
} as const

/** Class IN; mDNS uses the top bit of a record's class for "cache flush", which is masked off here. */
export const CLASS_IN = 1
export const CLASS_MASK = 0x7f_ff

/** The service a device advertises while it takes lockdown connections over Wi-Fi. */
export const WIFI_LOCKDOWN_SERVICE = '_apple-mobdev2._tcp.local'

/** The service an iOS 17+ device's remote pairing listens on: the way to its tunnel over Wi-Fi. */
export const REMOTE_PAIRING_SERVICE = '_remotepairing._tcp.local'

/**
 * The service an Apple TV or Apple Vision Pro advertises while its pairing screen is open (Remote App and Devices,
 * Remote Devices): pair-setup with the code it shows. It takes no tunnel; that goes to `_remotepairing._tcp`.
 */
export const MANUAL_PAIRING_SERVICE = '_remotepairing-manual-pairing._tcp.local'

/** Most compression pointers a name may follow before it counts as a loop. */
export const MAX_NAME_JUMPS = 32
