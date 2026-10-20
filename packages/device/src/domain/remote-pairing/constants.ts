// Remote pairing (iOS 17.4 and later): the lockdown service, its frames and the pair-setup and pair-verify
// constants. Pair-setup is SRP-6a with the RFC 5054 3072-bit group and SHA-512, a fixed PIN over USB (the device
// has already been trusted), then Ed25519 identities exchanged under ChaCha20-Poly1305.

/** The lockdown service that speaks remote pairing over the classic (lockdown) connection. */
export const REMOTE_PAIRING_SERVICE =
  'com.apple.dt.remotepairingdeviced.lockdown'

/** Each frame starts with this ASCII tag, then a big-endian u16 length and that many bytes of UTF-8 JSON. */
export const FRAME_MAGIC = 'RPPairing'

/** The largest JSON body a u16 length can carry. */
export const MAX_FRAME_BYTES = 0xff_ff

/** The protocol version the handshake announces. */
export const WIRE_PROTOCOL_VERSION = 19

/** TLV8 record types (HomeKit-style pairing). */
export const TlvType = {
  Method: 0x00,
  Identifier: 0x01,
  Salt: 0x02,
  PublicKey: 0x03,
  Proof: 0x04,
  EncryptedData: 0x05,
  State: 0x06,
  Error: 0x07,
  RetryDelay: 0x08,
  Signature: 0x0a,
  Info: 0x11
} as const

/** A TLV8 value longer than this is split into consecutive records of the same type. */
export const TLV_FRAGMENT_BYTES = 255

/** The `kind` of each pairing data event. */
export const PairingKind = {
  Setup: 'setupManualPairing',
  Verify: 'verifyManualPairing'
} as const

/** SRP over USB: the device is already trusted, so the PIN is fixed. */
export const SRP_USER = 'Pair-Setup'
export const USB_PIN = '000000'

/** RFC 5054 Appendix A, 3072-bit group. */
export const SRP_3072_N = BigInt(
  '0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
    'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
    'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F' +
    '83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
    'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA0510' +
    '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
    'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C' +
    'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF'
)
export const SRP_3072_G = 5n
export const SRP_3072_BYTES = 384

/** HKDF-SHA512 salt and info strings of each derived key. */
export const KeyDerivation = {
  setupEncrypt: ['Pair-Setup-Encrypt-Salt', 'Pair-Setup-Encrypt-Info'],
  controllerSign: [
    'Pair-Setup-Controller-Sign-Salt',
    'Pair-Setup-Controller-Sign-Info'
  ],
  accessorySign: [
    'Pair-Setup-Accessory-Sign-Salt',
    'Pair-Setup-Accessory-Sign-Info'
  ],
  verifyEncrypt: ['Pair-Verify-Encrypt-Salt', 'Pair-Verify-Encrypt-Info']
} as const

/** ChaCha20-Poly1305 nonces: 4 zero bytes, then this 8-byte label. */
export const Nonce = {
  setupM5: 'PS-Msg05',
  setupM6: 'PS-Msg06',
  verifyM2: 'PV-Msg02',
  verifyM3: 'PV-Msg03'
} as const
