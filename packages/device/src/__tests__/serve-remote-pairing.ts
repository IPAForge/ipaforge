// Test-only: a fake device's remote pairing side served over a byte connection, as a device's pairing port does:
// RPPairing frames in, its answers out as frames, until the connection closes.
import type { createFakeRemoteDevice } from '@device/__tests__/fake-remote-device.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  bodyOf,
  encodeFrame
} from '@device/infrastructure/remote-pairing/channel.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

const MAGIC = utf8Encode('RPPairing')

export const serveRemotePairing = async (
  link: Link,
  device: ReturnType<typeof createFakeRemoteDevice>
): Promise<void> => {
  let sequenceNumber = 0
  try {
    for (;;) {
      await link.reader.readExact(MAGIC.byteLength)
      const header = await link.reader.readExact(2)
      const length = new DataView(header.buffer, header.byteOffset).getUint16(0)
      const envelope: unknown = JSON.parse(
        utf8Decode(await link.reader.readExact(length))
      )
      await device.channel.send(bodyOf(envelope))
      // Everything the device has to say after this message.
      for (;;) {
        const body = await device.channel.receive().catch(() => undefined)
        if (!body) break
        await link.write(
          encodeFrame({
            message: { plain: { _0: body } },
            originatedBy: 'device',
            sequenceNumber: sequenceNumber++
          })
        )
      }
    }
  } catch {
    // The host closed the connection.
  } finally {
    await link.close().catch(() => undefined)
  }
}
