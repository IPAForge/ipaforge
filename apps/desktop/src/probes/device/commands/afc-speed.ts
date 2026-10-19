// `device-probe afc-speed [--mb <size>]`: how fast a file goes to the device's PublicStaging over AFC with each write
// chunk size (64 KiB is IPAForge's today), the same file each time, deleted after. Over USB and over Wi-Fi it
// differs a lot, so run it on both.
import { randomBytes } from 'node:crypto'

import { createMemorySecretStore } from '@desktop/main/adapters/memory-secret-store.ts'
import { createNodeUsbmuxTransport } from '@desktop/main/adapters/usbmux-transport.ts'
import type { DeviceProbe } from '@desktop/probes/device/context.ts'
import { createProbeLogger } from '@desktop/probes/shared/logger.ts'
import { createDeviceManager } from '@ipaforge/device'

const STAGING = 'PublicStaging'
const KIB = 1024
const CHUNKS = [64 * KIB, 256 * KIB, 1024 * KIB, 4096 * KIB]
const DEFAULT_MB = 32

/** Seconds to write `data` with writes of `chunk` bytes: a device session of its own, so the setting takes. */
const timeWrite = async (
  udid: string,
  data: Uint8Array,
  chunk: number
): Promise<number> => {
  const manager = createDeviceManager({
    transport: createNodeUsbmuxTransport(),
    secrets: createMemorySecretStore(),
    logger: createProbeLogger(),
    config: { afcWriteChunkBytes: chunk }
  })
  const handle = await manager.open(udid)
  const afc = await handle.openMedia()
  const path = `${STAGING}/ipaforge-speed-${Date.now()}.bin`

  try {
    if (!(await afc.exists(STAGING))) await afc.mkdir(STAGING)
    const started = performance.now()

    await afc.writeFile(path, data)

    return (performance.now() - started) / 1000
  } finally {
    await afc.remove(path).catch(() => undefined)
    await afc.close()
    await handle.close()
  }
}

export const afcSpeedCommand =
  ({ args, pickDevice, show }: DeviceProbe) =>
  async (): Promise<void> => {
    const device = await pickDevice()
    const mb = Number(args.option('mb') ?? DEFAULT_MB)
    const data = new Uint8Array(randomBytes(mb * KIB * KIB))

    console.log(
      `${show(device.udid)} over ${device.connectionType}: ${mb} MiB to ${STAGING}, each chunk size twice`
    )
    for (const chunk of CHUNKS) {
      const runs = [
        await timeWrite(device.udid, data, chunk),
        await timeWrite(device.udid, data, chunk)
      ]
      const best = Math.min(...runs)

      const times = runs.map((seconds) => seconds.toFixed(2) + ' s').join(', ')

      console.log(
        `${String(chunk / KIB).padStart(5)} KiB chunks: ${times} → ${(mb / best).toFixed(1)} MiB/s`
      )
    }
  }
