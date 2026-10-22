import { XPC_UUID_BYTES } from '@device/infrastructure/rsd/constants.ts'
import { ErrorCode, IPAForgeError, toHex } from '@ipaforge/kernel'

/** An XPC UUID: 16 raw bytes, told apart from data (`Uint8Array`) by its class. */
export class XpcUuid {
  readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    if (bytes.length !== XPC_UUID_BYTES)
      throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
        message: `XPC: a UUID is ${XPC_UUID_BYTES} bytes, not ${bytes.length}`
      })
    this.bytes = bytes.slice()
  }

  /** `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`, upper case. */
  toString(): string {
    const hex = toHex(this.bytes).toUpperCase()

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join('-')
  }
}
